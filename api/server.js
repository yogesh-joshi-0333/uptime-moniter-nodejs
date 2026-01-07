// api/server.js
// Express API with MySQL (root), Redis for SSE and admin actions, and static UI.

const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const Redis = require('ioredis');
const path = require('path');

const app = express();
app.use(bodyParser.json());

// MySQL configuration
const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '12345',
  database: process.env.MYSQL_DATABASE || 'sitechecker',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(MYSQL_CONFIG);

// Redis clients
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redis = new Redis(REDIS_URL);

// Helper for async route errors
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ---------- Website CRUD ----------
app.post('/websites', asyncHandler(async (req, res) => {
  const { url, interval_seconds } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      'INSERT INTO websites (url, interval_seconds) VALUES (?, ?)',
      [url, interval_seconds || 60]
    );
    const insertedId = result.insertId;
    res.status(201).json({ id: insertedId, url, interval_seconds: interval_seconds || 60 });
  } finally {
    conn.release();
  }
}));

app.delete('/websites/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    await conn.execute('DELETE FROM websites WHERE id = ?', [id]);
    res.status(204).send();
  } finally {
    conn.release();
  }
}));

app.get('/websites', asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM websites');
    res.json(rows);
  } finally {
    conn.release();
  }
}));

// ---------- Logs endpoint ----------
app.get('/logs', asyncHandler(async (req, res) => {
  const { websiteId, from, to } = req.query;
  let query = 'SELECT * FROM uptime_logs WHERE 1=1';
  const params = [];
  if (websiteId) {
    params.push(websiteId);
    query += ' AND website_id = ?';
  }
  if (from) {
    params.push(from);
    query += ' AND checked_at >= ?';
  }
  if (to) {
    params.push(to);
    query += ' AND checked_at <= ?';
  }
  query += ' ORDER BY checked_at DESC LIMIT 1000';
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(query, params);
    res.json(rows);
  } finally {
    conn.release();
  }
}));

// ---------- Serve static UI ----------
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Server-Sent Events for live logs ----------
app.get('/logs/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Create a NEW Redis connection for this subscriber
  const subscriber = new Redis(REDIS_URL);
  
  subscriber.subscribe('uptime:log', (err) => {
    if (err) {
      console.error('Redis subscribe error:', err);
      res.end();
      return;
    }
  });

  subscriber.on('message', (channel, message) => {
    res.write(`data: ${message}\n\n`);
  });

  req.on('close', () => {
    subscriber.unsubscribe('uptime:log');
    subscriber.disconnect();
  });
});

// ---------- Admin endpoint to kill pending jobs ----------
app.post('/admin/kill', asyncHandler(async (req, res) => {
  await redis.del('uptime:jobs');
  res.json({ status: 'jobs cleared' });
}));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});
