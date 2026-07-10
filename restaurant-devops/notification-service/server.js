const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const amqp = require('amqplib');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8085;

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let isUsingRabbit = false;
let rabbitChannel = null;
const IN_QUEUE = 'payment.completed';

// WebSocket Client Management
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('[Notification Service] Client connected via WebSocket');
  clients.add(ws);
  
  ws.send(JSON.stringify({ event: 'connected', message: 'Successfully connected to Notification Service WS' }));
  
  ws.on('close', () => {
    console.log('[Notification Service] Client disconnected');
    clients.delete(ws);
  });
  
  ws.on('error', (err) => {
    console.error('[Notification Service] WebSocket error:', err.message);
    clients.delete(ws);
  });
});

// Broadcast Helper
function broadcast(payload) {
  const dataString = JSON.stringify(payload);
  console.log(`[Notification Service] Broadcasting event "${payload.event}" to ${clients.size} clients.`);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(dataString);
    }
  }
}

// Initialize RabbitMQ
async function initRabbit() {
  const amqpUrl = process.env.RABBITMQ_URL;
  if (!amqpUrl) {
    console.log('[Notification Service] No RABBITMQ_URL found. WebSocket broadcasting active via HTTP fallback.');
    return;
  }
  try {
    const conn = await amqp.connect(amqpUrl);
    rabbitChannel = await conn.createChannel();
    await rabbitChannel.assertQueue(IN_QUEUE, { durable: true });
    isUsingRabbit = true;
    console.log('[Notification Service] Connected to RabbitMQ. Listening on:', IN_QUEUE);
    
    rabbitChannel.consume(IN_QUEUE, (msg) => {
      if (msg !== null) {
        try {
          const payload = JSON.parse(msg.content.toString());
          console.log('[Notification Service] Message consumed from RabbitMQ:', payload.event);
          broadcast(payload);
          rabbitChannel.ack(msg);
        } catch (e) {
          console.error('[Notification Service] Error broadcasting RabbitMQ message:', e.message);
          rabbitChannel.nack(msg, false, false); // Nack and drop to avoid loop
        }
      }
    });
  } catch (err) {
    console.error('[Notification Service] RabbitMQ setup failed. Running on HTTP fallback. Error:', err.message);
    isUsingRabbit = false;
  }
}

initRabbit();

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'notification-service',
    broker: isUsingRabbit ? 'RabbitMQ' : 'HTTP Fallback',
    websocketActiveClients: clients.size
  });
});

// HTTP REST route for publishing notifications (for testing and direct proxying)
app.post('/api/notifications/publish', (req, res) => {
  const payload = req.body;
  if (!payload || !payload.event || !payload.data) {
    return res.status(400).json({ error: 'Payload must contain "event" and "data"' });
  }
  
  broadcast(payload);
  res.json({ message: 'Notification published successfully' });
});

// Start Server (Use server.listen to support both Express and WebSocket)
server.listen(PORT, () => {
  console.log(`[Notification Service] Running on port ${PORT}`);
});
