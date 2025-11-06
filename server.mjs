// server.mjs (fully commented)

import express from "express";
import "dotenv/config"; // Load environment variables ASAP

// --- Services & APIs (domain/application layers)
import { createDb } from "./database/factoryDB/databaseFactory.mjs";

import createCorsMiddleware from "./middleware/cors.mjs";

import createStockServices from "./services/stockServices/stockServices.mjs";
import createOrdersService from "./services/orderServices/orderServices.mjs";
import createStripeServices from "./services/stripe/stripeServices.mjs";
import createPageServices from "./services/pageServices/pageServices.mjs";

import createStocksAPI from "./api/stockAPI.mjs";
import createOrdersAPI from "./api/ordersAPI.mjs";
import createStripeAPI from "./api/stripeAPI.mjs";
import createEmailAPI from "./api/emailAPI.mjs";
import createPageApi from "./api/pageAPI.mjs";

// --- Email (transport + service)
import createEmailService from "./services/emailServices/emailService.mjs";
import brevoTransport from "./services/emailServices/utils/brevoTransports.mjs";
import createSubscribeAPI from "./api/subscribeAPI.mjs";

// --- Stripe webhook router (must use raw body; mount before express.json())
import stripeWebhook from "./services/stripe/WEBHOOK/webhook.mjs";
import createPromoCodeServices from "./services/promoCodesServices/promoCodeServices.mjs";
import createPromotionCodeAPI from "./api/promotionCodeAPI.mjs";
import createVideoUploadServices from "./services/videoUploadServices/videoUploadServices.mjs";
import createVideosAPI from "./api/videosAPI.mjs";

import multer from "multer";

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage() });

// -----------------------------------------------------------------------------
// CORS
// -----------------------------------------------------------------------------
const corsMiddleware = createCorsMiddleware();
// Apply CORS for all routes
app.use(corsMiddleware);
// Preflight for all routes
app.options("*", corsMiddleware);

// -----------------------------------------------------------------------------
// Email Service (uses Brevo transport)
// -----------------------------------------------------------------------------
/**
 * emailService abstracts the act of sending emails (e.g., invoices).
 * brevoTransport is a provider-specific adapter (Brevo/SendingBlue).
 * If you switch providers later, only swap this transport.
 */
const emailService = createEmailService({ transport: brevoTransport });

// -----------------------------------------------------------------------------
// Database & Domain Services
// -----------------------------------------------------------------------------
/**
 * Create the database connection/driver based on env (e.g., memory, sqlite, pg).
 * All lower layers (services) receive this db handle.
 */
const db = await createDb({ type: process.env.DB_TYPE });

/**
 * Domain services encapsulate business logic and data access:
 * - stockService: products & stock operations
 * - ordersService: order creation/retrieval/update
 * - stripeServices: create checkout sessions, etc. (uses stockService)
 */
const stockService = createStockServices(db);
const stripeServices = createStripeServices(stockService);
const ordersService = createOrdersService(
  db,
  stripeServices,
  emailService,
  stockService
);
const promotionCodeServices = createPromoCodeServices(db);
const pageServices = createPageServices(db);
const videoUploadServices = createVideoUploadServices(
  db,
  emailService,
  promotionCodeServices
);

// -----------------------------------------------------------------------------
// API Layer (controllers)
// -----------------------------------------------------------------------------
/**
 * Controllers turn HTTP requests into service calls and HTTP responses.
 * They DO NOT directly touch the database; they call services.
 */
const stockApi = createStocksAPI(stockService);
const ordersApi = createOrdersAPI(ordersService);
const stripeAPi = createStripeAPI(stripeServices);
const emailApi = createEmailAPI(emailService); // --- New Contact API
const subscribeApi = createSubscribeAPI(); // --- New Subscribe API
const promoCodeApi = createPromotionCodeAPI(promotionCodeServices);
const pageAPI = createPageApi(pageServices); // --- New Page API
const videoUploadApi = createVideosAPI(videoUploadServices); // --- New Upload API

// -----------------------------------------------------------------------------
// Stripe Webhook
// -----------------------------------------------------------------------------
/**
 * IMPORTANT ORDERING:
 * 1) Mount the Stripe webhook BEFORE express.json() because it needs express.raw().
 * 2) The router itself uses `express.raw({ type: "application/json" })`.
 * 3) This endpoint is called by Stripe (server-to-server) after checkout completes.
 */
app.use("/api/stripe/webhook", stripeWebhook({ ordersService, stockService }));
// -----------------------------------------------------------------------------
// Global JSON Parser (for normal JSON API routes)
// -----------------------------------------------------------------------------
/**
 * After the webhook, enable JSON parsing for all other routes.
 * Do NOT put this before the webhook, or signature verification will fail.
 */
app.use(express.json());

// -----------------------------------------------------------------------------
// Orders API
// -----------------------------------------------------------------------------
/**
 * Basic CRUD for orders (if your business logic allows).
 * Typically, creation is handled by the webhook; but you expose endpoints
 * for admin or system integrations if needed.
 *
 *
 * Also a handleChekoutSessionThat will see wich checkout, the inquiry or the handle checkout
 */
app.get("/api/orders", ordersApi.getOrdersAPI);
app.get("/api/ordersByFolder/:folderName", ordersApi.getOrdersByFolderAPI);
app.post("/api/orders/move", ordersApi.moveOrdersAPI);

app.get("/api/orders/session/:sessionId", ordersApi.getOrderBySessionIdAPI);
app.get("/api/orders/:id", ordersApi.getOrderByIdAPI);
app.post("/api/orders", ordersApi.createOrderAPI);
app.patch("/api/orders/:id", ordersApi.updateOrderAPI);
//app.post("/api/checkout-sessionsv1", stripeAPi.handleCheckoutSession);
app.post("/api/checkout-sessions", ordersApi.handleCheckoutSession);

// -----------------------------------------------------------------------------
// Stock API
// -----------------------------------------------------------------------------
/**
 * Endpoints to read/update stock levels.
 * Adjust route protection as needed (e.g., admin auth middleware).
 */
app.get("/api/stock", stockApi.getStockAPI);
app.patch("/api/stock/:id", stockApi.updateStockAPI);
app.patch("/api/stock/:id/adjust", stockApi.adjustStockAPI);

// -----------------------------------------------------------------------------
// Products API
// -----------------------------------------------------------------------------
/**
 * Public product catalog endpoints used by your frontend and Stripe checkout session builder.
 * - /api/products: list all products
 * - /api/products/:id: get a single product by id
 */
app.get("/api/products", stockApi.getProductsAPI);
app.get("/api/products/:id", stockApi.getProductByIdAPI);

// -----------------------------------------------------------------------------
// PromoCode API
// -----------------------------------------------------------------------------
app.post("/api/promoCodes", promoCodeApi.createPromoCode);
app.get("/api/promoCodes", promoCodeApi.getPromoCodes);
app.patch("/api/promoCodes/:id", promoCodeApi.updatePromoCode);
app.post("/api/validatePromoCode", promoCodeApi.validatePromocode)

// -----------------------------------------------------------------------------
// Contact Form API
// -----------------------------------------------------------------------------
/**
 * Handles frontend contact form submissions from /api/contactUs.
 * You can expand later to use Brevo or another mailer.
 */
app.post("/api/email/invoice", emailApi.handleSendThankYouAndAdmin);
app.post("/api/email/inquireEmails", emailApi.handleSendInquiryOrderEmails);
app.post("/api/email/shipping", emailApi.handleShippingEmail);
app.post("/api/contactUs", emailApi.handleContactForm); // --- New Contact API
app.post("/api/video-upload-email", emailApi.handleVideoSubmission);
app.post(
  "/api/admin-submission-notification",
  emailApi.handleAdminSubmissionNotification
);
app.post("/api/submission-approval", emailApi.handleSubmissionApproval);
app.post("/api/submission-rejection", emailApi.handleSubmissionRejection);

// -----------------------------------------------------------------------------
// Brevo for subscrivers
// -----------------------------------------------------------------------------
/**
 * Handles frontend contact form submissions from /api/contactUs.
 * You can expand later to use Brevo or another mailer.
 */

app.post("/api/subscribe", subscribeApi.handleSubscribe); // --- New Subscribe API

// -----------------------------------------------------------------------------
// GET PAGE CONFIGURATION
// -----------------------------------------------------------------------------
/**
 * Handles frontend contact form submissions from /api/contactUs.
 * You can expand later to use Brevo or another mailer.
 */

app.get("/page/config", pageAPI.getPageApi); // --- New Subscribe API
app.get("/api/blogs/:slug", pageAPI.getBlogPostApi); // --- New Subscribe API

//---------------------------------------------------------------------------
//UploadRelated API
// -----------------------------------------------------------------------------
app.post("/api/upload", upload.single("video"), videoUploadApi.uploadVideo);
app.post("/api/upload/accept/:id", videoUploadApi.acceptVideo);
app.post("/api/upload/decline/:id", videoUploadApi.declineVideo);
app.get("/api/videosMetadata", videoUploadApi.getVideosMetadata);
app.get("/api/video/:id", videoUploadApi.getVideoById);
// -----------------------------------------------------------------------------
// Server Boot
// -----------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

export default app;
