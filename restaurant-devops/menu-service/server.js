const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const redis = require('redis');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8082;

app.use(cors());
app.use(express.json());

let isUsingDB = false;
let dbPool = null;

let isUsingRedis = false;
let redisClient = null;

// Seed Data
const initialMenu = [
  { id: 1, food_name: "Truffle Burger", price: 18.99, category: "Burgers", availability: true, image_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=80" },
  { id: 2, food_name: "Margherita Pizza", price: 14.50, category: "Pizzas", availability: true, image_url: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=500&q=80" },
  { id: 3, food_name: "Avocado Caesar Salad", price: 12.00, category: "Salads", availability: true, image_url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=500&q=80" },
  { id: 4, food_name: "Lava Chocolate Cake", price: 8.50, category: "Desserts", availability: true, image_url: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=500&q=80" },
  { id: 5, food_name: "Spicy Ramen", price: 16.00, category: "Main Course", availability: true, image_url: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=500&q=80" },
  { id: 6, food_name: "Iced Caramel Macchiato", price: 5.50, category: "Beverages", availability: true, image_url: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=500&q=80" }
];

let menuMemoryDB = [...initialMenu];
const memoryCache = {}; // Local memory cache fallback for Redis

// Initialize Database
async function initDB() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('[Menu Service] No DATABASE_URL found. Using In-Memory DB.');
    return;
  }
  try {
    dbPool = new Pool({ connectionString: dbUrl });
    await dbPool.query('SELECT NOW()');
    isUsingDB = true;
    console.log('[Menu Service] Successfully connected to PostgreSQL Database.');
    
    // Create menu table
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS menu (
        id SERIAL PRIMARY KEY,
        food_name VARCHAR(100) NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        category VARCHAR(50) NOT NULL,
        availability BOOLEAN NOT NULL DEFAULT true,
        image_url VARCHAR(500)
      );
    `);
    
    // Seed database if empty
    const countRes = await dbPool.query('SELECT count(*) FROM menu');
    if (parseInt(countRes.rows[0].count) === 0) {
      console.log('[Menu Service] Database is empty. Seeding initial menu...');
      for (const item of initialMenu) {
        await dbPool.query(
          'INSERT INTO menu (food_name, price, category, availability, image_url) VALUES ($1, $2, $3, $4, $5)',
          [item.food_name, item.price, item.category, item.availability, item.image_url]
        );
      }
      console.log('[Menu Service] Seeding complete.');
    }
  } catch (err) {
    console.error('[Menu Service] Database connection failed. Using In-Memory DB. Error:', err.message);
    isUsingDB = false;
  }
}

// Initialize Redis
async function initRedis() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('[Menu Service] No REDIS_URL found. Using In-Memory caching fallback.');
    return;
  }
  try {
    redisClient = redis.createClient({ url: redisUrl });
    redisClient.on('error', (err) => {
      console.error('[Menu Service] Redis Client Error:', err.message);
      isUsingRedis = false;
    });
    await redisClient.connect();
    isUsingRedis = true;
    console.log('[Menu Service] Successfully connected to Redis Cache.');
  } catch (err) {
    console.error('[Menu Service] Redis connection failed. Using In-Memory caching fallback. Error:', err.message);
    isUsingRedis = false;
  }
}

initDB();
initRedis();

// Caching Helpers
async function getCachedMenu() {
  const cacheKey = 'restaurant:menu';
  if (isUsingRedis) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log('[Menu Service] Redis Cache HIT');
        return JSON.parse(cached);
      }
    } catch (e) {
      console.error('[Menu Service] Error reading from Redis:', e.message);
    }
  } else {
    if (memoryCache[cacheKey]) {
      console.log('[Menu Service] Memory Cache HIT');
      return memoryCache[cacheKey];
    }
  }
  return null;
}

async function setCachedMenu(menuData) {
  const cacheKey = 'restaurant:menu';
  if (isUsingRedis) {
    try {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(menuData)); // Cache for 1 hour
      console.log('[Menu Service] Saved menu to Redis Cache');
    } catch (e) {
      console.error('[Menu Service] Error writing to Redis:', e.message);
    }
  } else {
    memoryCache[cacheKey] = menuData;
    console.log('[Menu Service] Saved menu to Memory Cache');
  }
}

async function clearCache() {
  const cacheKey = 'restaurant:menu';
  if (isUsingRedis) {
    try {
      await redisClient.del(cacheKey);
      console.log('[Menu Service] Cleared Redis Cache');
    } catch (e) {
      console.error('[Menu Service] Error clearing Redis:', e.message);
    }
  } else {
    delete memoryCache[cacheKey];
    console.log('[Menu Service] Cleared Memory Cache');
  }
}

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'menu-service',
    database: isUsingDB ? 'PostgreSQL' : 'In-Memory (Fallback)',
    cache: isUsingRedis ? 'Redis' : 'In-Memory Cache (Fallback)'
  });
});

// GET all menu items
app.get('/api/menu', async (req, res) => {
  try {
    // Check Cache First
    const cached = await getCachedMenu();
    if (cached) {
      return res.json(cached);
    }
    
    // Fetch from Database/Memory
    let menuItems = [];
    if (isUsingDB) {
      const dbRes = await dbPool.query('SELECT * FROM menu ORDER BY id ASC');
      // Convert price strings to float
      menuItems = dbRes.rows.map(item => ({ ...item, price: parseFloat(item.price) }));
    } else {
      menuItems = menuMemoryDB;
    }
    
    // Write back to Cache
    await setCachedMenu(menuItems);
    res.json(menuItems);
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET single item
app.get('/api/menu/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let item = null;
    
    if (isUsingDB) {
      const dbRes = await dbPool.query('SELECT * FROM menu WHERE id = $1', [id]);
      if (dbRes.rows[0]) {
        item = { ...dbRes.rows[0], price: parseFloat(dbRes.rows[0].price) };
      }
    } else {
      item = menuMemoryDB.find(m => m.id === id);
    }
    
    if (!item) {
      return res.status(404).json({ error: 'Food item not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// CREATE food item
app.post('/api/menu', async (req, res) => {
  try {
    const { food_name, price, category, availability, image_url } = req.body;
    if (!food_name || price === undefined || !category) {
      return res.status(400).json({ error: 'Name, price, and category are required' });
    }
    
    let newItem = null;
    if (isUsingDB) {
      const dbRes = await dbPool.query(
        'INSERT INTO menu (food_name, price, category, availability, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [food_name, price, category, availability !== false, image_url || '']
      );
      newItem = { ...dbRes.rows[0], price: parseFloat(dbRes.rows[0].price) };
    } else {
      newItem = {
        id: menuMemoryDB.length > 0 ? Math.max(...menuMemoryDB.map(m => m.id)) + 1 : 1,
        food_name,
        price: parseFloat(price),
        category,
        availability: availability !== false,
        image_url: image_url || ''
      };
      menuMemoryDB.push(newItem);
    }
    
    // Clear cache since menu structure changed
    await clearCache();
    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// UPDATE food item
app.put('/api/menu/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { food_name, price, category, availability, image_url } = req.body;
    
    let updatedItem = null;
    if (isUsingDB) {
      const dbRes = await dbPool.query(
        'UPDATE menu SET food_name = $1, price = $2, category = $3, availability = $4, image_url = $5 WHERE id = $6 RETURNING *',
        [food_name, price, category, availability, image_url, id]
      );
      if (dbRes.rows[0]) {
        updatedItem = { ...dbRes.rows[0], price: parseFloat(dbRes.rows[0].price) };
      }
    } else {
      const index = menuMemoryDB.findIndex(m => m.id === id);
      if (index !== -1) {
        menuMemoryDB[index] = {
          id,
          food_name: food_name || menuMemoryDB[index].food_name,
          price: price !== undefined ? parseFloat(price) : menuMemoryDB[index].price,
          category: category || menuMemoryDB[index].category,
          availability: availability !== undefined ? availability : menuMemoryDB[index].availability,
          image_url: image_url || menuMemoryDB[index].image_url
        };
        updatedItem = menuMemoryDB[index];
      }
    }
    
    if (!updatedItem) {
      return res.status(404).json({ error: 'Food item not found' });
    }
    
    await clearCache();
    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE food item
app.delete('/api/menu/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let success = false;
    
    if (isUsingDB) {
      const dbRes = await dbPool.query('DELETE FROM menu WHERE id = $1 RETURNING *', [id]);
      if (dbRes.rowCount > 0) success = true;
    } else {
      const index = menuMemoryDB.findIndex(m => m.id === id);
      if (index !== -1) {
        menuMemoryDB.splice(index, 1);
        success = true;
      }
    }
    
    if (!success) {
      return res.status(404).json({ error: 'Food item not found' });
    }
    
    await clearCache();
    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`[Menu Service] Running on port ${PORT}`);
});
