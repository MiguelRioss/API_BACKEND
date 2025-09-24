// server.mjs
import { EventEmitter } from "events";
EventEmitter.defaultMaxListeners = 20;

import express from "express";
import handleFactory from './utils/handleFactory.mjs';
import errorHandler from "./middleware/errorHandler.mjs";
import { health } from "./api/health.mjs";
import { testErrorHandler } from "./api/testErros/testErros.mjs";
import createOrdersService from "./services/orderServices.mjs";
import { createDb } from "./database/databaseFactory.mjs";
import createOrdersAPI from "./api/ordersAPI.mjs";
import createCorsMiddleware from "./middleware/cors.mjs";
import debugOrders from './api/debugOrders.mjs'; // path to file you created


const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// CORS: configured middleware
const corsMiddleware = createCorsMiddleware();
app.use(corsMiddleware);
app.use(debugOrders);


// OPTIONAL explicit preflight handler (uncomment if you want it):
// app.use((req, res, next) => {
//   if (req.method === "OPTIONS") return corsMiddleware(req, res, () => (!res.headersSent ? res.sendStatus(204) : undefined));
//   next();
// });

// Initialize DB/services
const db = await createDb();
const ordersService = createOrdersService(db);
const ordersApi = createOrdersAPI(ordersService);

// Routes
app.get("/health", handleFactory(health));
app.get("/api/test-error", handleFactory(testErrorHandler));
app.get("/api/orders", handleFactory(ordersApi.getOrdersAPI));
app.get("/api/orders/:id", handleFactory(ordersApi.getOrderByIdAPI));
app.post("/api/orders",handleFactory(ordersApi.createOrderAPI))
// add to your express app routes (ONLY temporarily for debugging)
app.post('/__debug/create-order', async (req, res) => {
  try {
    // accepts full order object in request body
    const order = req.body;
    console.info('[DEBUG CREATE ORDER] incoming body:', JSON.stringify(order));
    // call same function your API uses:
    const result = await db.createOrderDB(order, order.id ?? undefined);
    // return success response with DB result
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    // return full error info (do NOT expose private keys; this prints only error metadata)
    console.error('[DEBUG CREATE ORDER] ERROR ->', err && err.stack ? err.stack : err);
    const details = {
      message: err && err.message,
      name: err && err.name,
      code: err && err.code,
      status: err && err.status,
      // include any vendor error fields (e.g. firebase code)
      firebase: err && err.details ? err.details : undefined,
    };
    return res.status(500).json({ ok: false, debug_error: details });
  }
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

export default app;
