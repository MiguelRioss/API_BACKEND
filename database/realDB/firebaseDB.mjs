// database/firebaseDB.mjs
import "dotenv/config"; // dotenv is idempotent
import { initFirebase, getRealtimeDB, getFirestore, useRealtimeDB } from "../firebase/firebaseInit.mjs";
import errors from "../../errors/errors.mjs"; // <- use your ApplicationError style
import { getStorage } from "firebase-admin/storage"; // <-- make sure this import is at the top


/**
 * Ensure Firebase is initialized before any db operation.
 * Wraps init errors as externalService.
 */
function ensureInitDb() {
  try {
    initFirebase();
  } catch (err) {
    return Promise.reject(
      errors.externalService(`Firebase initialization failed: ${err?.message ?? err}`, {
        original: err,
      })
    );
  }
}

/**
 * Get all orders (RTDB or Firestore depending on env).
 *
 * @returns {Promise<Object[]>} Array of orders.
 * @rejects {externalService} If DB call fails.
 */
export async function getAllOrders() {
  const init = ensureInitDb();
  if (init) return init; // ensureInitDb may return a rejected promise

  if (useRealtimeDB()) {
    const db = getRealtimeDB();
    return db
      .ref("/orders")
      .once("value")
      .then((snap) => snap.val() || {})
      .then((val) => Object.entries(val).map(([id, data]) => ({ id, ...data })))
      .catch((err) =>
        Promise.reject(errors.externalService("Failed to read orders from DB", { original: err }))
      );
  }

  return Promise.reject(errors.internal("No supported DB configured"));
}


/**
 * Get all orders (RTDB or Firestore depending on env).
 *
 * @returns {Promise<Object[]>} Array of orders.
 * @rejects {externalService} If DB call fails.
 */
export async function getAllOrdersByFolder(folderName) {
  const init = ensureInitDb();
  if (init) return init; // ensureInitDb may return a rejected promise

  if (useRealtimeDB()) {
    const db = getRealtimeDB();
    return db
      .ref(folderName)
      .once("value")
      .then((snap) => snap.val() || {})
      .then((val) => Object.entries(val).map(([id, data]) => ({ id, ...data })))
      .catch((err) =>
        Promise.reject(errors.externalService("Failed to read orders from DB", { original: err }))
      );
  }

  return Promise.reject(errors.internal("No supported DB configured"));
}


/**
 * Get a single order by id.
 *
 * @param {string} idStr - Normalized order ID.
 * @returns {Promise<Object>} The found order (with id property).
 * @rejects {notFound} If order doesn't exist.
 */
export async function getOrderById(idStr) {
  const init = ensureInitDb();
  if (init) return init;

  if (useRealtimeDB()) {
    const db = getRealtimeDB();
    const snap = await db.ref(`/orders/${idStr}`).once("value");
    const val = snap.val();
    if (val === null || typeof val === "undefined") {
      return Promise.reject(errors.notFound(`Order ${idStr} not found`));
    }
    return { id: idStr, ...val };
  }
}


export async function getOrderByStripeSessionId(sessionId) {
  const orders = await getAllOrders();

  const order = orders.find((o, i) => { return o.session_id === sessionId });
  if (!order) {
    return Promise.reject(errors.notFound(`Order with session_id "${sessionId}" not found`))
  }

  return order;
}

export async function getPageConfig() {
  const init = ensureInitDb();
  if (init) return init;

  if (useRealtimeDB()) {
    const db = getRealtimeDB();
    const snap = await db.ref("/site_config/mesodoseConfig").once("value");
    return snap.val();
  }

  const firestore = getFirestore();
  const doc = await firestore.collection("site_config").doc("mesodoseConfig").get();
  if (!doc.exists) {
    return null;
  }
  return doc.data();
}

/**
 * Create a new order in the DB.
 *
 * @param {Object} orderData
 * @returns {Promise<Object>} The created order.
 */
export async function createOrderDB(orderData = {}) {
  const init = ensureInitDb();
  if (init) return init;

  const createdAt = new Date().toISOString();
  const payload = { ...orderData, createdAt };  // <-- define once, in scope
  let applied = []; // for rollback

  try {
    if (!useRealtimeDB()) {
      return Promise.reject(
        errors.externalService("Firestore create not implemented yet")
      );
    }

    const db = getRealtimeDB();

    // 1) Take a snapshot and decrement stock (using your working updateStock-based helper)
    //If not enough stock it will rollback
    const stockSnapshot = await getStocks();
    applied = (await findStockAndDecrement(stockSnapshot, orderData)) || [];

    // 2) Write order
    let result;
    if (payload.id != null) {
      const key = String(payload.id);
      await db.ref(`/orders/${key}`).set(payload);
      result = { id: key, ...payload };
    } else {
      const newRef = db.ref("/orders").push();
      await newRef.set(payload);
      result = { id: newRef.key, ...payload };
    }

    return result;
  } catch (err) {
    // 3) Rollback stock if order write failed after decrements
    if (applied.length) {
      console.warn("[createOrderDB] order write failed; rolling back stock…");
      for (const { stockId, prev, name } of applied.reverse()) {
        try {
          await updateStock(stockId, { name, stockValue: prev });
          console.log(`[createOrderDB] rollback ok for id=${stockId} → ${prev}`);
        } catch (rbErr) {
          console.warn(`[createOrderDB] rollback failed for id=${stockId}:`, rbErr?.message || rbErr);
        }
      }
    }
    if (err && typeof err === "object" && Number.isFinite(Number(err.httpStatus))) {
      return Promise.reject(err);
    }
    return Promise.reject(
      errors.externalService("Failed to write order to DB", { original: err })
    );
  }
}



/**
 * Update an order by replacing it with the provided object.
 * Same contract as localDB.updateOrderDB — service layer handles merging/normalization.
 *
 * @async
 * @param {string|number} id - Order ID
 * @param {Object} updatedOrder - Fully prepared order object
 * @returns {Promise<Object>} The updated order (with id included)
 * @rejects {notFound} If the order doesn’t exist
 * @rejects {externalService} On DB write failure
 */
export async function updateOrderDB(id, updatedOrder) {
  ensureInitDb(); // throws or rejects if Firebase isn’t ready


  if (!useRealtimeDB()) {
    return Promise.reject(
      errors.externalService("Firestore update not implemented yet")
    );
  }

  const db = getRealtimeDB();
  const ref = db.ref(`/orders/${id}`);
  const snap = await ref.once("value");

  if (!snap.exists()) {
    return Promise.reject(errors.notFound(`Order "${id}" not found`));
  }

  return ref
    .set(updatedOrder) // overwrite with prepared object
    .then(() => ({ id: id, ...updatedOrder }))
    .catch((err) =>
      Promise.reject(
        errors.externalService("Failed to update order in Firebase", {
          original: err?.message ?? String(err),
        })
      )
    );
}


//Stocks
/**
 * Get all Stocks (RTDB depending on env).
 *
 * @returns {Promise<Object[]>} Array of Stocks Int.
 * @rejects {externalService} If DB call fails.
 */
export async function getStocks() {
  const init = ensureInitDb();
  if (init) return init; // ensureInitDb may return a rejected promise

  if (useRealtimeDB()) {
    const db = getRealtimeDB();
    return db
      .ref("/stock")
      .once("value")
      .then((snap) => snap.val() || {})
      .then((val) => Object.entries(val).map(([id, data]) => ({ id: Number(id), name: data.title, stockValue: data.stockValue, price: data.priceInEuros })))
      .catch((err) =>
        Promise.reject(errors.externalService("Failed to read orders from DB", { original: err }))
      );
  }

  return Promise.resolve([]);
}


/**
 * Get all Products from DB.
 */
export async function getProducts() {
  const init = ensureInitDb();
  if (init) return init;

  if (useRealtimeDB()) {
    const db = getRealtimeDB();
    return db.ref("/stock")
      .once("value")
      .then((snap) => snap.val() || {})
      .then((val) =>
        Object.entries(val).map(([id, data]) => ({
          id: Number(id),
          ...data,
        }))
      );
  }
  return [];
}
/**
 * Update an order by replacing it with the provided object.
 * Same contract as localDB.updateOrderDB — service layer handles merging/normalization.
 *
 * @async
 * @param {string|number} id - Order ID
 * @param {Object} updatedOrder - Fully prepared order object
 * @returns {Promise<Object>} The updated order (with id included)
 * @rejects {notFound} If the order doesn’t exist
 * @rejects {externalService} On DB write failure
 */
export async function updateStock(id, updatedStock) {
  ensureInitDb(); // throws or rejects if Firebase isn’t ready


  if (!useRealtimeDB()) {
    return Promise.reject(
      errors.externalService("Firestore update not implemented yet")
    );
  }

  const db = getRealtimeDB();
  const ref = db.ref(`/stock/${id}`);
  const snap = await ref.once("value");

  if (!snap.exists()) {
    return Promise.reject(errors.notFound(`Order "${id}" not found`));
  }

  return ref
    .set(updatedStock) // overwrite with prepared object
    .then(() => ({ id: id, ...updatedStock }))
    .catch((err) =>
      Promise.reject(
        errors.externalService("Failed to update order in Firebase", {
          original: err?.message ?? String(err),
        })
      )
    );
}

/**
 * Get a single order by id.
 *
 * @param {string} idStr - Normalized order ID.
 * @returns {Promise<Object>} The found order.
 * @rejects {notFound} If order doesn’t exist.
 */
export async function getStockByID(idStr) {
  const init = ensureInitDb();
  if (init) return init;

  if (useRealtimeDB()) {
    const db = getRealtimeDB();
    const id = String(idStr).trim();

    const snap = await db.ref(`/stock/${id}`).once("value");
    const val = snap.val();

    if (val === null || typeof val === "undefined") {
      return Promise.reject(errors.notFound(`Stock ${id} not found`));
    }

    return { id, ...val };
  }
}

/**
 * Find each stock item from the order and decrement stockValue ONLY.
 * Uses RTDB transactions; performs best-effort rollback on error.
 *
 * @param {Object[]} stockSnapshot - Current stock list from DB (id, name, stockValue)
 * @param {Object} orderData       - The order data (expects .items with {id, quantity})
 * @returns {Promise<Object[]>} Applied decrements { stockId, qty }
 */
export async function findStockAndDecrement(stockSnapshot, orderData) {
  if (!orderData?.items || !Array.isArray(orderData.items)) return [];
  const applied = [];

  for (const item of orderData.items) {
    const stockId = Number(item.id);

    const qty = Number(item.quantity);

    const found = stockSnapshot.find(s => Number(s.id) === stockId);
    if (!found)
      return Promise.reject(errors.invalidData(`STOCK with id :${stockId} notFound`));

    const newVal = Number(found.stockValue) - qty;
    if (!Number.isFinite(newVal) || newVal < 0)
      return Promise.reject(errors.badRequest(`INSUFFICIENT_STOCK for id:${stockId}`));

    await updateStockValue(stockId, newVal);          // <-- only field-level update
    applied.push({ stockId, prev: Number(found.stockValue) });
  }
  return applied;
}


// database/firebaseDB.mjs
export async function updateStockValue(id, stockValue) {
  ensureInitDb();
  if (!useRealtimeDB()) throw errors.externalService("Firestore update not implemented yet");

  const db = getRealtimeDB();
  // PATCH the field (preserves all other product fields)
  await db.ref(`/stock/${id}`).update({ stockValue });
  return { id, stockValue };
}


export async function createPromoCodeDB(promoCodeObj) {
  ensureInitDb();
  if (!useRealtimeDB()) throw errors.externalService("FireStore update not implementedyet");

  const db = getRealtimeDB();
  const newRef = db.ref("/promoCodes").push();
  await newRef.set(promoCodeObj);
  const result = { id: newRef.key, ...promoCodeObj };
  return result;
}

export async function getPromoCodes() {
  const init = ensureInitDb();
  if (init) return init;

  if (!useRealtimeDB()) {
    return Promise.reject(errors.externalService("FireStore get not implemented yet"));
  }

  const db = getRealtimeDB();
  return db
    .ref("/promoCodes")
    .once("value")
    .then((snap) => snap.val() || {})
    .then((val) =>
      Object.entries(val).map(([id, data]) => ({
        id,
        ...data,
      }))
    )
    .catch((err) =>
      Promise.reject(
        errors.externalService("Failed to read promo codes from DB", {
          original: err,
        })
      )
    );
}

/**
* Get a single promo code by its ID.
*/
export async function getPromoCodeById(id) {
  const init = ensureInitDb();
  if (init) return init;

  if (!useRealtimeDB()) {
    return Promise.reject(
      errors.externalService("Firestore read not implemented yet")
    );
  }

  const db = getRealtimeDB();
  const ref = db.ref(`/promoCodes/${id}`);
  const snap = await ref.once("value");
  const val = snap.val();

  if (val === null || typeof val === "undefined") {
    return Promise.reject(errors.notFound(`Promo code "${id}" not found`));
  }

  return { id, ...val };
}
/**
* Patch (partial update) existing promo code.
* Only applies provided fields; preserves everything else.
*
* @param {string} id - Promo code ID
* @param {Object} updates - Key/value pairs to patch
* @returns {Promise<Object>} - Updated promo code
*/
export async function patchPromoCodeDB(id, updates) {
  ensureInitDb();
  if (!useRealtimeDB()) {
    return Promise.reject(
      errors.externalService("Firestore patch not implemented yet")
    );
  }

  if (!updates || typeof updates !== "object") {
    return Promise.reject(errors.invalidData("Invalid update payload"));
  }

  const db = getRealtimeDB();
  const ref = db.ref(`/promoCodes/${id}`);

  const snap = await ref.once("value");
  if (!snap.exists()) {
    return Promise.reject(errors.notFound(`Promo code "${id}" not found`));
  }

  await ref.update(updates);
  const newData = { ...(snap.val() || {}), ...updates };
  return { id, ...newData };
}



// -----------------------------------------------------------------------------
// Upload Video to Storage
// -----------------------------------------------------------------------------
export async function uploadVideoToStorage(file) {
  const init = ensureInitDb();
  if (init) return init;

  if (!file || !file.buffer || !file.mimetype.startsWith("video/")) {
    throw errors.invalidData("Invalid or missing video file");
  }

  try {
    const storage = getStorage();
    const bucketName = 'storageproducts-bbe30.firebasestorage.app';
    const bucket = storage.bucket(bucketName);

    const videoId = Date.now().toString();
    const filename = `videos/${videoId}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const blob = bucket.file(filename);

    // Upload the file
    await blob.save(file.buffer, {
      contentType: file.mimetype,
      public: true,
      metadata: {
        firebaseStorageDownloadTokens: videoId,
        metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString()
        }
      }
    });

    // For the new Firebase Storage URL format
    // ✅ FIXED: Use the correct Firebase Storage URL format
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filename)}?alt=media&token=${videoId}`;

    console.log(`Video uploaded successfully: ${filename}`);
    return {
      id: videoId,
      url,
      filename,
      bucket: bucket.name,
      size: file.buffer.length
    };

  } catch (error) {
    console.error('Storage upload error:', error);

    if (error.code === 404) {
      throw errors.externalService(`Storage bucket not found. Please check if bucket 'storageproducts-bbe30.firebasestorage.app' exists.`);
    } else {
      throw errors.externalService(`Failed to upload video: ${error.message}`);
    }
  }
}
// -----------------------------------------------------------------------------
// Save Video Metadata to Realtime DB
// -----------------------------------------------------------------------------
export async function saveVideoMetadata(videoData) {
  const init = ensureInitDb();
  if (init) return init;

  if (!useRealtimeDB()) {
    return Promise.reject(errors.externalService("Firestore not yet implemented for videos"));
  }

  const db = getRealtimeDB();
  const ref = db.ref(`/videos/${videoData.id}`);
  await ref.set(videoData);
  return videoData;
}

// -----------------------------------------------------------------------------
// Retrieve all uploaded videos
// -----------------------------------------------------------------------------
export async function getAllVideos() {
  const init = ensureInitDb();
  if (init) return init;

  const db = getRealtimeDB();
  const snap = await db.ref("/videos").once("value");
  const val = snap.val() || {};
  return Object.entries(val).map(([id, data]) => ({ id, ...data }));
}
// -----------------------------------------------------------------------------
// Retrieve a blog by its slug//title
// -----------------------------------------------------------------------------
export async function getBlogPost(slugBlogPost) {
  const init = ensureInitDb();
  if (init) return init;
  const db = getRealtimeDB();
  const snap = await db.ref(`/blogs/${slugBlogPost}`).once("value");
  const val = snap.val();
  if (val === null) {
    return Promise.reject(errors.notFound(`Post "${slugBlogPost}" not found`));
  }
  return val 
}
// -----------------------------------------------------------------------------
// Get all the blogPosts
// -----------------------------------------------------------------------------
export async function getAllBlogs() {
  const init = ensureInitDb();
  if (init) return init;
  const db = getRealtimeDB();
  const snap = await db.ref(`/blogs`).once("value");
  const val = snap.val();
  if (val === null) {
    return Promise.reject(errors.notFound(`Blogs were not found`));
  }
  return val 
}

// -----------------------------------------------------------------------------
// Retrieve one video by ID
// -----------------------------------------------------------------------------
export async function getVideoById(id) {
  const init = ensureInitDb();
  if (init) return init;

  const db = getRealtimeDB();
  const snap = await db.ref(`/videos/${id}`).once("value");
  const val = snap.val();
  if (val === null) {
    return Promise.reject(errors.notFound(`Video "${id}" not found`));
  }
  return { id, ...val };
}

// -----------------------------------------------------------------------------
// Delete Video from Storage and Metadata from Realtime DB
// -----------------------------------------------------------------------------
export async function deleteVideoById(id) {
  const init = ensureInitDb();
  if (init) return init;

  try {
    // 1. First get the video metadata to find the filename
    const videoMetadata = await getVideoById(id);

    if (!videoMetadata || !videoMetadata.filename) {
      throw errors.notFound(`Video metadata not found for ID: ${id}`);
    }

    // 2. Delete from Storage
    const storage = getStorage();
    const bucketName = 'storageproducts-bbe30.firebasestorage.app';
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(videoMetadata.filename);

    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      console.log(`Video file deleted from storage: ${videoMetadata.filename}`);
    } else {
      console.warn(`Video file not found in storage: ${videoMetadata.filename}`);
    }

    // 3. Delete from Realtime DB
    if (useRealtimeDB()) {
      const db = getRealtimeDB();
      const ref = db.ref(`/videos/${id}`);
      await ref.remove();
      console.log(`Video metadata deleted from DB: ${id}`);
    }

    return {
      success: true,
      id: id,
      filename: videoMetadata.filename,
      message: 'Video and metadata deleted successfully'
    };

  } catch (error) {
    console.error('Delete video error:', error);

    if (error.code === 404 || error.httpStatus === 404) {
      throw errors.notFound(`Video not found: ${error.message}`);
    } else if (error.code === 403) {
      throw errors.externalService(`Permission denied: ${error.message}`);
    } else {
      throw errors.externalService(`Failed to delete video: ${error.message}`);
    }
  }
}

/**
 * Patch (partial update) an existing video entry in Realtime DB.
 * Only applies provided fields; preserves everything else.
 *
 * @param {string} id - Video ID
 * @param {Object} updates - Key/value pairs to patch
 * @returns {Promise<Object>} - Updated video object
 */
export async function patchVideo(id, updates) {
  ensureInitDb();
  if (!useRealtimeDB()) {
    return Promise.reject(
      errors.externalService("Firestore patch not implemented yet for videos")
    );
  }

  if (!id || typeof updates !== "object") {
    return Promise.reject(errors.invalidData("Invalid patch payload or ID"));
  }

  const db = getRealtimeDB();
  const ref = db.ref(`/videos/${id}`);

  const snap = await ref.once("value");
  if (!snap.exists()) {
    return Promise.reject(errors.notFound(`Video "${id}" not found`));
  }

  // Apply partial update
  await ref.update(updates);

  const newData = { ...(snap.val() || {}), ...updates };
  return { id, ...newData };
}


/**
 * Atomically move one or many orders between top-level RTDB folders.
 * Example: moveOrdersBetweenFolders(["A","B"], "orders", "archive")
 *
 * @param {string[]|string} ids            - Order id or array of ids to move
 * @param {string} fromFolderName          - Source folder ("orders" | "archive" | "deleted")
 * @param {string} toFolderName            - Destination folder ("orders" | "archive" | "deleted")
 * @returns {Promise<{moved:number, skipped:string[]}>}
 * @rejects {externalService|internal} on failure
 */
export async function moveOrdersBetweenFolders(ids, fromFolderName, toFolderName) {
  const init = ensureInitDb();
  if (init) return init; // may return a rejected promise

  const idList = Array.isArray(ids) ? ids : [ids];
  if (!idList.length) {
    return Promise.reject(errors.internal("No ids provided to move"));
  }
  if (!fromFolderName || !toFolderName) {
    return Promise.reject(errors.internal("Both fromFolderName and toFolderName are required"));
  }
  if (fromFolderName === toFolderName) {
    return { moved: 0, skipped: [...idList] };
  }

  if (!useRealtimeDB()) {
    return Promise.reject(errors.internal("No supported DB configured"));
  }

  try {
    const db = getRealtimeDB();
    const movedAt = Date.now();
    const updates = {};
    const skipped = [];

    // Fetch each source record; only move if it exists
    const reads = await Promise.allSettled(
      idList.map(async (id) => {
        const snap = await db.ref(`${fromFolderName}/${id}`).once("value");
        if (!snap.exists()) {
          skipped.push(id);
          return;
        }
        const data = snap.val();
        // copy to destination (add lightweight audit trail), delete from source
        updates[`/${toFolderName}/${id}`] = { ...data, _movedAt: movedAt, _from: fromFolderName };
        updates[`/${fromFolderName}/${id}`] = null;
      })
    );

    // If nothing to update, return early
    const updateKeys = Object.keys(updates);
    if (updateKeys.length === 0) {
      return { moved: 0, skipped };
    }

    // Atomic multi-path update
    await db.ref().update(updates);

    const moved = idList.length - skipped.length;
    return { moved, skipped };
  } catch (err) {
    throw errors.externalService("Failed to move orders between folders", { original: err });
  }
}

/**
 * Convenience wrapper to move a single order.
 */
export function moveOrderBetweenFolders(id, fromFolderName, toFolderName) {
  return moveOrdersBetweenFolders([id], fromFolderName, toFolderName);
}
