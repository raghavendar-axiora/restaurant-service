const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const amqp = require('amqplib');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8083;

app.use(cors());
app.use(express.json());

let isUsingDB = false;
let dbPool = null;

let isUsingRabbit = false;
let rabbitChannel = null;
const QUEUE_NAME = 'order.created';

const ordersMemoryDB = [];
const orderItemsMemoryDB = [];

// Initialize Database
async function initDB() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('[Order Service] No DATABASE_URL found. Using In-Memory DB.');
    return;
  }
  try {
    dbPool = new Pool({ connectionString: dbUrl });
    await dbPool.query('SELECT NOW()');
    isUsingDB = true;
    console.log('[Order Service] Successfully connected to PostgreSQL Database.');
    
    // Create Tables
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        total_amount NUMERIC(10, 2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Pending',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL,
        food_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price NUMERIC(10, 2) NOT NULL
      );
    `);
    console.log('[Order Service] Checked/created "orders" and "order_items" tables.');
  } catch (err) {
    console.error('[Order Service] Database connection failed. Using In-Memory DB. Error:', err.message);
    isUsingDB = false;
  }
}

// Initialize RabbitMQ
async function initRabbit() {
  const amqpUrl = process.env.RABBITMQ_URL;
  if (!amqpUrl) {
    console.log('[Order Service] No RABBITMQ_URL found. Will use HTTP fallback for communication.');
    return;
  }
  try {
    const conn = await amqp.connect(amqpUrl);
    rabbitChannel = await conn.createChannel();
    await rabbitChannel.assertQueue(QUEUE_NAME, { durable: true });
    isUsingRabbit = true;
    console.log('[Order Service] Connected to RabbitMQ. Asserted queue:', QUEUE_NAME);
  } catch (err) {
    console.error('[Order Service] RabbitMQ connection failed. Will use HTTP fallback. Error:', err.message);
    isUsingRabbit = false;
  }
}

initDB();
initRabbit();

// Helper to notify payment service
async function notifyPayment(order) {
  const messagePayload = JSON.stringify(order);
  
  if (isUsingRabbit) {
    try {
      rabbitChannel.sendToQueue(QUEUE_NAME, Buffer.from(messagePayload), { persistent: true });
      console.log('[Order Service] Event published to RabbitMQ:', QUEUE_NAME);
      return;
    } catch (err) {
      console.error('[Order Service] Error publishing to RabbitMQ:', err.message);
    }
  }
  
  // HTTP Fallback to Payment Service
  const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:8084';
  console.log(`[Order Service] Falling back to HTTP proxy. Sending order to ${paymentServiceUrl}/api/payments/process`);
  try {
    // Dynamically fetch to avoid using external fetch packages if possible
    const http = require('http');
    const parsedUrl = new URL(`${paymentServiceUrl}/api/payments/process`);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(messagePayload)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`[Order Service] Payment Service HTTP response: ${res.statusCode} - ${data}`);
      });
    });
    
    req.on('error', (e) => {
      console.error('[Order Service] HTTP notification to Payment Service failed:', e.message);
    });
    
    req.write(messagePayload);
    req.end();
  } catch (e) {
    console.error('[Order Service] Failed to trigger payment service via HTTP:', e.message);
  }
}

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'order-service',
    database: isUsingDB ? 'PostgreSQL' : 'In-Memory (Fallback)',
    broker: isUsingRabbit ? 'RabbitMQ' : 'HTTP Fallback'
  });
});

// CREATE Order
app.post('/api/orders', async (req, res) => {
  try {
    const { user_id, items, total_amount } = req.body;
    if (!user_id || !items || !items.length || total_amount === undefined) {
      return res.status(400).json({ error: 'user_id, items (array), and total_amount are required' });
    }
    
    let newOrder = null;
    let savedItems = [];
    
    if (isUsingDB) {
      // Start transaction
      const client = await dbPool.connect();
      try {
        await client.query('BEGIN');
        
        const orderRes = await client.query(
          'INSERT INTO orders (user_id, total_amount, status) VALUES ($1, $2, $3) RETURNING *',
          [user_id, total_amount, 'Pending']
        );
        newOrder = { ...orderRes.rows[0], total_amount: parseFloat(orderRes.rows[0].total_amount) };
        
        for (const item of items) {
          const itemRes = await client.query(
            'INSERT INTO order_items (order_id, food_id, quantity, price) VALUES ($1, $2, $3, $4) RETURNING *',
            [newOrder.id, item.food_id, item.quantity, item.price]
          );
          savedItems.push({ ...itemRes.rows[0], price: parseFloat(itemRes.rows[0].price) });
        }
        
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } else {
      newOrder = {
        id: ordersMemoryDB.length > 0 ? Math.max(...ordersMemoryDB.map(o => o.id)) + 1 : 1,
        user_id: parseInt(user_id),
        total_amount: parseFloat(total_amount),
        status: 'Pending',
        created_at: new Date()
      };
      ordersMemoryDB.push(newOrder);
      
      for (const item of items) {
        const newItem = {
          id: orderItemsMemoryDB.length > 0 ? Math.max(...orderItemsMemoryDB.map(oi => oi.id)) + 1 : 1,
          order_id: newOrder.id,
          food_id: item.food_id,
          quantity: item.quantity,
          price: parseFloat(item.price)
        };
        orderItemsMemoryDB.push(newItem);
        savedItems.push(newItem);
      }
    }
    
    newOrder.items = savedItems;
    
    // Asynchronously dispatch payment trigger
    notifyPayment(newOrder);
    
    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET all orders
app.get('/api/orders', async (req, res) => {
  try {
    const userId = req.query.user_id;
    let ordersList = [];
    
    if (isUsingDB) {
      let queryStr = 'SELECT * FROM orders';
      const params = [];
      if (userId) {
        queryStr += ' WHERE user_id = $1';
        params.push(parseInt(userId));
      }
      queryStr += ' ORDER BY created_at DESC';
      
      const ordersRes = await dbPool.query(queryStr, params);
      
      for (const order of ordersRes.rows) {
        const itemRes = await dbPool.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
        ordersList.push({
          ...order,
          total_amount: parseFloat(order.total_amount),
          items: itemRes.rows.map(i => ({ ...i, price: parseFloat(i.price) }))
        });
      }
    } else {
      let tempOrders = [...ordersMemoryDB];
      if (userId) {
        tempOrders = tempOrders.filter(o => o.user_id === parseInt(userId));
      }
      ordersList = tempOrders.map(order => ({
        ...order,
        items: orderItemsMemoryDB.filter(i => i.order_id === order.id)
      })).reverse(); // Latest orders first
    }
    
    res.json(ordersList);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET single order
app.get('/api/orders/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let order = null;
    
    if (isUsingDB) {
      const orderRes = await dbPool.query('SELECT * FROM orders WHERE id = $1', [id]);
      if (orderRes.rows[0]) {
        order = { ...orderRes.rows[0], total_amount: parseFloat(orderRes.rows[0].total_amount) };
        const itemRes = await dbPool.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
        order.items = itemRes.rows.map(i => ({ ...i, price: parseFloat(i.price) }));
      }
    } else {
      const baseOrder = ordersMemoryDB.find(o => o.id === id);
      if (baseOrder) {
        order = {
          ...baseOrder,
          items: orderItemsMemoryDB.filter(i => i.order_id === baseOrder.id)
        };
      }
    }
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// UPDATE Order Status (Triggered by Chef, Delivery, Payment, or Admin)
app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    let updatedOrder = null;
    if (isUsingDB) {
      const dbRes = await dbPool.query(
        'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
        [status, id]
      );
      if (dbRes.rows[0]) {
        updatedOrder = { ...dbRes.rows[0], total_amount: parseFloat(dbRes.rows[0].total_amount) };
        const itemRes = await dbPool.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
        updatedOrder.items = itemRes.rows.map(i => ({ ...i, price: parseFloat(i.price) }));
      }
    } else {
      const index = ordersMemoryDB.findIndex(o => o.id === id);
      if (index !== -1) {
        ordersMemoryDB[index].status = status;
        updatedOrder = {
          ...ordersMemoryDB[index],
          items: orderItemsMemoryDB.filter(i => i.order_id === id)
        };
      }
    }
    
    if (!updatedOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Broadcast status change via notification service
    const wsServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8085';
    try {
      const http = require('http');
      const payload = JSON.stringify({ event: 'order.updated', data: updatedOrder });
      const parsedUrl = new URL(`${wsServiceUrl}/api/notifications/publish`);
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };
      
      const reqWS = http.request(options);
      reqWS.on('error', (e) => {
        console.error('[Order Service] Failed to notify Notification Service via HTTP:', e.message);
      });
      reqWS.write(payload);
      reqWS.end();
    } catch (e) {
      console.error('[Order Service] Notification broadcast failed:', e.message);
    }
    
    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`[Order Service] Running on port ${PORT}`);
});
