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


const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// CORS: configured middleware
const corsMiddleware = createCorsMiddleware();
app.use(corsMiddleware);


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
// add to your express app routes (ONLY temporarily for debugging)
app.post('/api/orders', ordersApi.createOrderAPI);

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

export default app;
