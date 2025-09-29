

import express from "express";
import createOrdersService from "./services/orderServices.mjs";
import { createDb } from "./database/databaseFactory.mjs";
import createOrdersAPI from "./api/ordersAPI.mjs";
import createCorsMiddleware from "./middleware/cors.mjs";
import createStripeWebhook, { STRIPE_WEBHOOK_PATH } from "./webhook/stripe_webhook.mjs";
import createStockServices from "./services/stockServices.mjs";
import createStocksAPI from "./api/stockAPI.mjs";
const app = express();
const PORT = process.env.PORT || 3000;

const corsMiddleware = createCorsMiddleware();
app.use(corsMiddleware);
app.options("*", corsMiddleware);

const db = await createDb({ type: process.env.DB_TYPE });

const stockService = createStockServices(db)
const ordersService = createOrdersService(db);

const stockApi = createStocksAPI(stockService)
const ordersApi = createOrdersAPI(ordersService);


const stripeWebhookHandler = createStripeWebhook({ ordersService });

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
//app.post("/api/stocks", ordersApi.updateOrderAPI);


process.on("SIGINT", async () => {
  await closeBrowser();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await closeBrowser();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

export default app;
