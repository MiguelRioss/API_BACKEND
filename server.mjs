// server.mjs
import { EventEmitter } from "events";
import { closeBrowser } from "./ctt/browserPool.mjs";

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
import createCttAPI from "./ctt/cttAPI.mjs";
const app = express();
const PORT = process.env.PORT || 3000;
// …after you create other APIs/services
app.use(express.json());

// CORS: configured middleware
const corsMiddleware = createCorsMiddleware();
app.use(corsMiddleware);

const db = await createDb();
const ordersService = createOrdersService(db);
const ordersApi = createOrdersAPI(ordersService);

const cttApi = createCttAPI();

// Routes
app.get("/health", handleFactory(health));
app.get("/api/test-error", handleFactory(testErrorHandler));
app.get("/api/orders", handleFactory(ordersApi.getOrdersAPI));
app.get("/api/orders/:id", handleFactory(ordersApi.getOrderByIdAPI));
// add to your express app routes (ONLY temporarily for debugging)
app.post('/api/orders', ordersApi.createOrderAPI);
app.patch('/api/orders/:id',ordersApi.updateOrderAPI)
// NEW: CTT
app.get("/api/ctt", cttApi.getStatusAPI); // paired events
//app.get("/api/ctt/timeline", handleFactory(cttApi.getTimelineAPI)); // 

// …

process.on("SIGINT",  async () => { await closeBrowser(); process.exit(0); });
process.on("SIGTERM", async () => { await closeBrowser(); process.exit(0); });

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

export default app;
