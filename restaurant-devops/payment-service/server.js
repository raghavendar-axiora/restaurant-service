const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const amqp = require('amqplib');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8084;

app.use(cors());
app.use(express.json());

let isUsingDB = false;
let dbPool = null;

let isUsingRabbit = false;
let rabbitChannel = null;
const IN_QUEUE = 'order.created';
const OUT_QUEUE = 'payment.completed';

const paymentsMemoryDB = [];

// Initialize Database
async function initDB() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('[Payment Service] No DATABASE_URL found. Using In-Memory DB.');
    return;
  }
  try {
    dbPool = new Pool({ connectionString: dbUrl });
    await dbPool.query('SELECT NOW()');
    isUsingDB = true;
    console.log('[Payment Service] Successfully connected to PostgreSQL Database.');
    
    // Create payments table
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        order_id INTEGER UNIQUE NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        payment_status VARCHAR(50) NOT NULL,
        transaction_id VARCHAR(100) UNIQUE NOT NULL
      );
    `);
    console.log('[Payment Service] Checked/created "payments" table.');
  } catch (err) {
    console.error('[Payment Service] Database connection failed. Using In-Memory DB. Error:', err.message);
    isUsingDB = false;
  }
}

// Initialize RabbitMQ Consumer & Publisher
async function initRabbit() {
  const amqpUrl = process.env.RABBITMQ_URL;
  if (!amqpUrl) {
    console.log('[Payment Service] No RABBITMQ_URL found. Running in HTTP fallback mode.');
    return;
  }
  try {
    const conn = await amqp.connect(amqpUrl);
    rabbitChannel = await conn.createChannel();
    
    await rabbitChannel.assertQueue(IN_QUEUE, { durable: true });
    await rabbitChannel.assertQueue(OUT_QUEUE, { durable: true });
    
    isUsingRabbit = true;
    console.log('[Payment Service] Connected to RabbitMQ. Listening on:', IN_QUEUE);
    
    // Consume messages
    rabbitChannel.consume(IN_QUEUE, async (msg) => {
      if (msg !== null) {
        try {
          const order = JSON.parse(msg.content.toString());
          console.log('[Payment Service] Received message from RabbitMQ. Processing payment for order ID:', order.id);
          await processPaymentLogic(order);
          rabbitChannel.ack(msg);
        } catch (e) {
          console.error('[Payment Service] Error processing RabbitMQ message:', e.message);
          // Nack and requeue if transient
          rabbitChannel.nack(msg, false, true);
        }
      }
    });
  } catch (err) {
    console.error('[Payment Service] RabbitMQ setup failed. Running in HTTP fallback. Error:', err.message);
    isUsingRabbit = false;
  }
}

initDB();
initRabbit();

// Core Payment Processing Logic
async function processPaymentLogic(order) {
  // Simulate network/gateway delay (1.5 seconds)
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const paymentMethod = 'Credit Card';
  const transactionId = 'TXN_' + Math.random().toString(36).substr(2, 9).toUpperCase();
  // Simulate successful payment (95% rate success, or fail if payment total is exactly 999 for testing)
  const isSuccessful = order.total_amount !== 999.00 && Math.random() > 0.05;
  const paymentStatus = isSuccessful ? 'Success' : 'Failed';
  const orderStatus = isSuccessful ? 'Paid' : 'Payment Failed';
  
  console.log(`[Payment Service] Payment status for Order ${order.id}: ${paymentStatus} (${transactionId})`);
  
  // 1. Save payment record
  if (isUsingDB) {
    try {
      await dbPool.query(
        'INSERT INTO payments (order_id, payment_method, payment_status, transaction_id) VALUES ($1, $2, $3, $4)',
        [order.id, paymentMethod, paymentStatus, transactionId]
      );
    } catch (dbErr) {
      console.error('[Payment Service] Failed to save payment record to database:', dbErr.message);
    }
  } else {
    paymentsMemoryDB.push({
      id: paymentsMemoryDB.length + 1,
      order_id: order.id,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      transaction_id: transactionId
    });
  }
  
  // 2. Update Order Status in Order Service
  await updateOrderStatus(order.id, orderStatus);
  
  // 3. Publish to RabbitMQ output queue or fallback to Notification Service direct HTTP
  const notificationPayload = {
    event: 'payment.processed',
    data: {
      order_id: order.id,
      payment_status: paymentStatus,
      transaction_id: transactionId,
      total_amount: order.total_amount,
      user_id: order.user_id
    }
  };
  
  if (isUsingRabbit) {
    try {
      rabbitChannel.sendToQueue(OUT_QUEUE, Buffer.from(JSON.stringify(notificationPayload)), { persistent: true });
      console.log('[Payment Service] Published payment notification event to RabbitMQ:', OUT_QUEUE);
      return;
    } catch (e) {
      console.error('[Payment Service] Failed to publish payment event to RabbitMQ:', e.message);
    }
  }
  
  // HTTP Fallback to Notification Service
  await notifyNotificationService(notificationPayload);
}

// HTTP Helper: Update Order Status in Order Service
async function updateOrderStatus(orderId, status) {
  const orderServiceUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:8083';
  const payload = JSON.stringify({ status });
  
  console.log(`[Payment Service] Updating order status: Sending PUT to ${orderServiceUrl}/api/orders/${orderId}/status`);
  
  try {
    const http = require('http');
    const parsedUrl = new URL(`${orderServiceUrl}/api/orders/${orderId}/status`);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    
    const req = http.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        console.log(`[Payment Service] Order Service status update response: ${res.statusCode}`);
      });
    });
    req.on('error', (e) => {
      console.error('[Payment Service] HTTP request to update order status failed:', e.message);
    });
    req.write(payload);
    req.end();
  } catch (err) {
    console.error('[Payment Service] Failed to update order status via HTTP:', err.message);
  }
}

// HTTP Helper: Notify Notification Service
async function notifyNotificationService(payload) {
  const notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8085';
  const body = JSON.stringify(payload);
  
  console.log(`[Payment Service] Sending payment details via HTTP to ${notificationServiceUrl}/api/notifications/publish`);
  
  try {
    const http = require('http');
    const parsedUrl = new URL(`${notificationServiceUrl}/api/notifications/publish`);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    
    const req = http.request(options);
    req.on('error', (e) => {
      console.error('[Payment Service] Failed to notify Notification Service via HTTP:', e.message);
    });
    req.write(body);
    req.end();
  } catch (err) {
    console.error('[Payment Service] Failed to proxy notification payload:', err.message);
  }
}

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'payment-service',
    database: isUsingDB ? 'PostgreSQL' : 'In-Memory (Fallback)',
    broker: isUsingRabbit ? 'RabbitMQ' : 'HTTP Fallback'
  });
});

// REST API for direct payment processing (fallback & testing)
app.post('/api/payments/process', async (req, res) => {
  const order = req.body;
  if (!order || !order.id || order.total_amount === undefined) {
    return res.status(400).json({ error: 'Valid order object with id and total_amount required' });
  }
  
  // Process payment asynchronously to avoid blocking the client request (mimics messaging queue behavior)
  processPaymentLogic(order);
  
  res.json({ message: 'Payment processing initiated' });
});

// GET all payments
app.get('/api/payments', async (req, res) => {
  try {
    if (isUsingDB) {
      const dbRes = await dbPool.query('SELECT * FROM payments');
      res.json(dbRes.rows);
    } else {
      res.json(paymentsMemoryDB);
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`[Payment Service] Running on port ${PORT}`);
});
