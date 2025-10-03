

import express from "express";
import createOrdersService from "./services/orderServices.mjs";
import { createDb } from "./database/databaseFactory.mjs";
import createOrdersAPI from "./api/ordersAPI.mjs";
import createCorsMiddleware from "./middleware/cors.mjs";
import { createStripeWebhook, STRIPE_WEBHOOK_PATH } from "./stripe/index.js";
import createStockServices from "./services/stockServices.mjs";
import createStocksAPI from "./api/stockAPI.mjs";
const app = express();
const PORT = process.env.PORT || 3000;

const corsMiddleware = createCorsMiddleware();
app.use(corsMiddleware);
app.options("*", corsMiddleware);

const db = await createDb({ type: process.env.DB_TYPE });

const stockService = createStockServices(db)
const ordersService = createOrdersService(db,stockService);

const stockApi = createStocksAPI(stockService)
const ordersApi = createOrdersAPI(ordersService);


const stripeWebhookHandler = createStripeWebhook({ ordersService, stockService });

app.post(
  STRIPE_WEBHOOK_PATH,
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

app.use(express.json());


app.get("/api/orders", ordersApi.getOrdersAPI);
app.get("/api/orders/:id", ordersApi.getOrderByIdAPI);
app.post("/api/orders", ordersApi.createOrderAPI);
app.patch("/api/orders/:id", ordersApi.updateOrderAPI);


//Stock
app.get("/api/stock", stockApi.getStockAPI);
app.patch("/api/stock/:id", stockApi.updateStockAPI);
app.patch("/api/stock/:id/adjust", stockApi.adjustStockAPI);



app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

export default app;
