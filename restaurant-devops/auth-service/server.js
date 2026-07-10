const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8081;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_restaurant_token_key';

app.use(cors());
app.use(express.json());

// In-Memory Database Fallback
let isUsingDB = false;
let dbPool = null;

const usersMemoryDB = [];

// Initialize database connection
async function initDB() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('[Auth Service] No DATABASE_URL environment variable found. Falling back to In-Memory DB.');
    return;
  }
  
  try {
    dbPool = new Pool({ connectionString: dbUrl });
    // Test the connection
    await dbPool.query('SELECT NOW()');
    console.log('[Auth Service] Successfully connected to PostgreSQL Database.');
    isUsingDB = true;
    
    // Create users table if not exists
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'customer',
        phone VARCHAR(20)
      );
    `);
    console.log('[Auth Service] Checked/created "users" table.');
  } catch (err) {
    console.error('[Auth Service] Database connection failed. Falling back to In-Memory DB. Error:', err.message);
    isUsingDB = false;
  }
}

initDB();

// Helper helper to get user by email
async function getUserByEmail(email) {
  if (isUsingDB) {
    const res = await dbPool.query('SELECT * FROM users WHERE email = $1', [email]);
    return res.rows[0];
  } else {
    return usersMemoryDB.find(u => u.email === email);
  }
}

// Helper helper to create user
async function createUser(name, email, hashedPassword, role, phone) {
  if (isUsingDB) {
    const res = await dbPool.query(
      'INSERT INTO users (name, email, password, role, phone) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, email, hashedPassword, role, phone]
    );
    return res.rows[0];
  } else {
    const newUser = {
      id: usersMemoryDB.length + 1,
      name,
      email,
      password: hashedPassword,
      role: role || 'customer',
      phone: phone || ''
    };
    usersMemoryDB.push(newUser);
    return newUser;
  }
}

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'auth-service', database: isUsingDB ? 'PostgreSQL' : 'In-Memory (Fallback)' });
});

// Register Route
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await createUser(name, email, hashedPassword, role, phone);
    
    // Do not return password in response
    const { password: _, ...userWithoutPassword } = user;
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Login Route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Verify Token Route
app.get('/api/auth/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Get Users List (for dashboard / admin management)
app.get('/api/auth/users', async (req, res) => {
  try {
    let users = [];
    if (isUsingDB) {
      const dbRes = await dbPool.query('SELECT id, name, email, role, phone FROM users');
      users = dbRes.rows;
    } else {
      users = usersMemoryDB.map(({ password, ...u }) => u);
    }
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`[Auth Service] Running on port ${PORT}`);
});
