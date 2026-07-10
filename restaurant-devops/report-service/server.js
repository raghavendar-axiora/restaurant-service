const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8086;

app.use(cors());
app.use(express.json());

let isUsingDB = false;
let dbPool = null;

// Initialize Database
async function initDB() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('[Report Service] No DATABASE_URL found. Will query Order Service for reporting data.');
    return;
  }
  try {
    dbPool = new Pool({ connectionString: dbUrl });
    await dbPool.query('SELECT NOW()');
    isUsingDB = true;
    console.log('[Report Service] Successfully connected to PostgreSQL Database.');
  } catch (err) {
    console.error('[Report Service] Database connection failed. Will query Order Service. Error:', err.message);
    isUsingDB = false;
  }
}

initDB();

// Helper to fetch orders from Order Service when running without direct DB access
async function fetchOrdersFromOrderService() {
  const orderServiceUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:8083';
  return new Promise((resolve, reject) => {
    const http = require('http');
    http.get(`${orderServiceUrl}/api/orders`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', (err) => {
      console.error('[Report Service] Failed to fetch orders from order-service via HTTP:', err.message);
      resolve([]);
    });
  });
}

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'report-service',
    database: isUsingDB ? 'PostgreSQL' : 'HTTP Query (Fallback)'
  });
});

// GET Dashboard Metrics
app.get('/api/reports/dashboard', async (req, res) => {
  try {
    let orders = [];
    
    if (isUsingDB) {
      // Query direct database aggregates
      const countRes = await dbPool.query('SELECT COUNT(*) FROM orders');
      const sumRes = await dbPool.query('SELECT SUM(total_amount) FROM orders WHERE status != $1', ['Payment Failed']);
      const usersRes = await dbPool.query('SELECT COUNT(DISTINCT user_id) FROM orders');
      
      const salesRes = await dbPool.query(`
        SELECT oi.food_id, COUNT(oi.id) as count, SUM(oi.quantity * oi.price) as revenue 
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status != 'Payment Failed'
        GROUP BY oi.food_id
      `);
      
      const totalOrders = parseInt(countRes.rows[0].count) || 0;
      const totalRevenue = parseFloat(sumRes.rows[0].sum) || 0;
      const uniqueCustomers = parseInt(usersRes.rows[0].count) || 0;
      
      return res.json({
        totalOrders,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        uniqueCustomers,
        itemsPerformance: salesRes.rows.map(row => ({
          food_id: parseInt(row.food_id),
          salesCount: parseInt(row.count),
          revenue: Math.round(parseFloat(row.revenue) * 100) / 100
        }))
      });
    } else {
      // Aggregate via HTTP fallback
      orders = await fetchOrdersFromOrderService();
      
      let totalOrders = orders.length;
      let totalRevenue = 0;
      const uniqueUserIds = new Set();
      const itemSales = {}; // food_id -> { count, revenue }
      
      orders.forEach(order => {
        if (order.status !== 'Payment Failed') {
          totalRevenue += order.total_amount;
          uniqueUserIds.add(order.user_id);
          
          if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
              const fId = item.food_id;
              if (!itemSales[fId]) {
                itemSales[fId] = { count: 0, revenue: 0 };
              }
              itemSales[fId].count += parseInt(item.quantity);
              itemSales[fId].revenue += parseFloat(item.price) * parseInt(item.quantity);
            });
          }
        }
      });
      
      const itemsPerformance = Object.keys(itemSales).map(fId => ({
        food_id: parseInt(fId),
        salesCount: itemSales[fId].count,
        revenue: Math.round(itemSales[fId].revenue * 100) / 100
      }));
      
      res.json({
        totalOrders,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        uniqueCustomers: uniqueUserIds.size,
        itemsPerformance
      });
    }
  } catch (error) {
    console.error('Error generating dashboard report:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`[Report Service] Running on port ${PORT}`);
});
