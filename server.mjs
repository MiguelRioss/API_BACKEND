

import express from "express";
import createOrdersService from "./services/orderServices.mjs";
import { createDb } from "./database/databaseFactory.mjs";
import createOrdersAPI from "./api/ordersAPI.mjs";
import createCorsMiddleware from "./middleware/cors.mjs";
import createStockServices from "./services/stockServices.mjs";
import createStocksAPI from "./api/stockAPI.mjs";

import checkoutRoutes from "./routes/checkoutSessions.mjs";
import stripeWebhook from "./stripe/webhook.mjs";

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


app.use("/api/stripe/webhook", stripeWebhook);

app.use(express.json());

app.use("/api", checkoutRoutes({ordersService, stockService}));

app.get("/api/orders", ordersApi.getOrdersAPI);
app.get("/api/orders/:id", ordersApi.getOrderByIdAPI);
app.post("/api/orders", ordersApi.createOrderAPI);
app.patch("/api/orders/:id", ordersApi.updateOrderAPI);


//Stock
app.get("/api/stock", stockApi.getStockAPI);
app.patch("/api/stock/:id", stockApi.updateStockAPI);
app.patch("/api/stock/:id/adjust", stockApi.adjustStockAPI);

// Products
app.get("/api/products", stockApi.getProductsAPI);
app.get("/api/products/:id", stockApi.getProductByIdAPI);



app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

export default app;
