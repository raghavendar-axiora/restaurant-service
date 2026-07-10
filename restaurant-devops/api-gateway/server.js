const express = require('express');
const cors = require('cors');
const proxy = require('express-http-proxy');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

// Microservice URLs (from Env, or local fallback)
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:8081';
const MENU_SERVICE_URL = process.env.MENU_SERVICE_URL || 'http://localhost:8082';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:8083';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:8084';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8085';
const REPORT_SERVICE_URL = process.env.REPORT_SERVICE_URL || 'http://localhost:8086';

// Request Logging Middleware
app.use((req, res, next) => {
  console.log(`[API Gateway] Request: ${req.method} ${req.url}`);
  next();
});

// Proxy routes
app.use('/api/auth', proxy(AUTH_SERVICE_URL, {
  proxyReqPathResolver: (req) => '/api/auth' + req.url
}));

app.use('/api/menu', proxy(MENU_SERVICE_URL, {
  proxyReqPathResolver: (req) => '/api/menu' + req.url
}));

app.use('/api/orders', proxy(ORDER_SERVICE_URL, {
  proxyReqPathResolver: (req) => '/api/orders' + req.url
}));

app.use('/api/payments', proxy(PAYMENT_SERVICE_URL, {
  proxyReqPathResolver: (req) => '/api/payments' + req.url
}));

app.use('/api/notifications', proxy(NOTIFICATION_SERVICE_URL, {
  proxyReqPathResolver: (req) => '/api/notifications' + req.url
}));

app.use('/api/reports', proxy(REPORT_SERVICE_URL, {
  proxyReqPathResolver: (req) => '/api/reports' + req.url
}));

// Fallback status check
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    gateway: 'api-gateway',
    downstream: {
      authService: AUTH_SERVICE_URL,
      menuService: MENU_SERVICE_URL,
      orderService: ORDER_SERVICE_URL,
      paymentService: PAYMENT_SERVICE_URL,
      notificationService: NOTIFICATION_SERVICE_URL,
      reportService: REPORT_SERVICE_URL
    }
  });
});

app.listen(PORT, () => {
  console.log(`[API Gateway] Running on port ${PORT}`);
});
