import express from 'express';
import debugOrders from './api/debugOrders.mjs'; // path relative to main file

const app = express();
app.use(express.json());

// other routers...
app.use(debugOrders);

// (optional) small ping to check server is redeployed
app.get('/_ping', (req, res) => res.send('pong'));
