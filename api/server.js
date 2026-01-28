// api/server.js
// Express API with MySQL, Redis for SSE and admin actions, JWT auth, and static UI.

const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const Redis = require('ioredis');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

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

// JWT Secret (use environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'uptime-monitor-secret-key-change-in-production';

// Demo admin user (in production, use database)
const ADMIN_USER = {
  id: 1,
  email: process.env.ADMIN_EMAIL || 'admin@example.com',
  password: process.env.ADMIN_PASSWORD || 'admin123',
  name: 'Admin'
};

// Helper for async route errors
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Simple JWT implementation
function createToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${data}`).digest('base64url');
  return `${header}.${data}.${signature}`;
}

function verifyToken(token) {
  try {
    const [header, data, signature] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${data}`).digest('base64url');
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// Auth middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.user = payload;
  next();
}

// ---------- Auth Routes ----------
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (email === ADMIN_USER.email && password === ADMIN_USER.password) {
    const token = createToken({ id: ADMIN_USER.id, email: ADMIN_USER.email });
    res.json({
      token,
      user: { id: ADMIN_USER.id, email: ADMIN_USER.email, name: ADMIN_USER.name }
    });
  } else {
    res.status(401).json({ error: 'Invalid email or password' });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email, name: ADMIN_USER.name } });
});

app.put('/api/auth/profile', authMiddleware, (req, res) => {
  const { name, email } = req.body;
  // In production, update database
  res.json({ user: { id: req.user.id, email: email || req.user.email, name: name || ADMIN_USER.name } });
});

app.put('/api/auth/password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (currentPassword !== ADMIN_USER.password) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  // In production, update database
  res.json({ message: 'Password updated successfully' });
});

// ---------- Website CRUD ----------
app.post('/api/websites', authMiddleware, asyncHandler(async (req, res) => {
  const { url, interval_seconds, name, notification_email } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      'INSERT INTO websites (url, name, interval_seconds, notification_email) VALUES (?, ?, ?, ?)',
      [url, name || null, interval_seconds || 60, notification_email || null]
    );
    const insertedId = result.insertId;
    res.status(201).json({
      id: insertedId,
      url,
      name: name || null,
      interval_seconds: interval_seconds || 60,
      notification_email: notification_email || null,
      created_at: new Date().toISOString()
    });
  } finally {
    conn.release();
  }
}));

app.get('/api/websites', asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    // Get websites with their latest status
    const [websites] = await conn.query(`
      SELECT w.*,
        (SELECT status FROM uptime_logs WHERE website_id = w.id ORDER BY checked_at DESC LIMIT 1) as lastStatus,
        (SELECT response_time_ms FROM uptime_logs WHERE website_id = w.id ORDER BY checked_at DESC LIMIT 1) as lastResponseTime,
        (SELECT checked_at FROM uptime_logs WHERE website_id = w.id ORDER BY checked_at DESC LIMIT 1) as lastChecked
      FROM websites w
      ORDER BY w.created_at DESC
    `);
    res.json(websites);
  } finally {
    conn.release();
  }
}));

app.get('/api/websites/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(`
      SELECT w.*,
        (SELECT status FROM uptime_logs WHERE website_id = w.id ORDER BY checked_at DESC LIMIT 1) as lastStatus,
        (SELECT response_time_ms FROM uptime_logs WHERE website_id = w.id ORDER BY checked_at DESC LIMIT 1) as lastResponseTime,
        (SELECT checked_at FROM uptime_logs WHERE website_id = w.id ORDER BY checked_at DESC LIMIT 1) as lastChecked
      FROM websites w
      WHERE w.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Website not found' });
    }
    res.json(rows[0]);
  } finally {
    conn.release();
  }
}));

app.put('/api/websites/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { url, interval_seconds, name, notification_email } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.execute(
      'UPDATE websites SET url = ?, name = ?, interval_seconds = ?, notification_email = ? WHERE id = ?',
      [url, name || null, interval_seconds || 60, notification_email || null, id]
    );

    const [rows] = await conn.execute('SELECT * FROM websites WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Website not found' });
    }
    res.json(rows[0]);
  } finally {
    conn.release();
  }
}));

app.delete('/api/websites/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    await conn.execute('DELETE FROM websites WHERE id = ?', [id]);
    res.status(204).send();
  } finally {
    conn.release();
  }
}));

// ---------- Website Stats ----------
app.get('/api/websites/:id/stats', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { period = '24h' } = req.query;

  let interval;
  switch (period) {
    case '1h': interval = '1 HOUR'; break;
    case '24h': interval = '24 HOUR'; break;
    case '7d': interval = '7 DAY'; break;
    case '30d': interval = '30 DAY'; break;
    default: interval = '24 HOUR';
  }

  const conn = await pool.getConnection();
  try {
    const [stats] = await conn.execute(`
      SELECT
        COUNT(*) as totalChecks,
        SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as upChecks,
        SUM(CASE WHEN status = 'down' THEN 1 ELSE 0 END) as downChecks,
        AVG(response_time_ms) as avgResponseTime,
        MIN(response_time_ms) as minResponseTime,
        MAX(response_time_ms) as maxResponseTime
      FROM uptime_logs
      WHERE website_id = ? AND checked_at >= DATE_SUB(NOW(), INTERVAL ${interval})
    `, [id]);

    const uptime = stats[0].totalChecks > 0
      ? (stats[0].upChecks / stats[0].totalChecks * 100).toFixed(2)
      : 100;

    res.json({
      ...stats[0],
      uptime: parseFloat(uptime)
    });
  } finally {
    conn.release();
  }
}));

// ---------- Logs endpoint ----------
app.get('/api/logs', asyncHandler(async (req, res) => {
  const { websiteId, from, to, status, page = 1, limit = 50 } = req.query;
  let query = 'SELECT l.*, w.url FROM uptime_logs l LEFT JOIN websites w ON l.website_id = w.id WHERE 1=1';
  const params = [];

  if (websiteId) {
    params.push(websiteId);
    query += ' AND l.website_id = ?';
  }
  if (status) {
    params.push(status);
    query += ' AND l.status = ?';
  }
  if (from) {
    params.push(from);
    query += ' AND l.checked_at >= ?';
  }
  if (to) {
    params.push(to);
    query += ' AND l.checked_at <= ?';
  }

  query += ' ORDER BY l.checked_at DESC';

  const offset = (parseInt(page) - 1) * parseInt(limit);
  query += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(query, params);
    res.json(rows);
  } finally {
    conn.release();
  }
}));

// ---------- Logs Count for Pagination ----------
app.get('/api/logs/count', asyncHandler(async (req, res) => {
  const { websiteId, from, to, status } = req.query;
  let query = 'SELECT COUNT(*) as count FROM uptime_logs l WHERE 1=1';
  const params = [];

  if (websiteId) {
    params.push(websiteId);
    query += ' AND l.website_id = ?';
  }
  if (status) {
    params.push(status);
    query += ' AND l.status = ?';
  }
  if (from) {
    params.push(from);
    query += ' AND l.checked_at >= ?';
  }
  if (to) {
    params.push(to);
    query += ' AND l.checked_at <= ?';
  }

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(query, params);
    res.json({ count: rows[0].count });
  } finally {
    conn.release();
  }
}));

// ---------- Dashboard Stats ----------
app.get('/api/stats/dashboard', asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    // Get overall stats
    const [websiteCount] = await conn.query('SELECT COUNT(*) as count FROM websites');

    const [logStats] = await conn.query(`
      SELECT
        COUNT(*) as totalChecks,
        SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as upChecks,
        SUM(CASE WHEN status = 'down' THEN 1 ELSE 0 END) as downChecks,
        AVG(response_time_ms) as avgResponseTime
      FROM uptime_logs
      WHERE checked_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);

    const [currentStatus] = await conn.query(`
      SELECT
        SUM(CASE WHEN latest.status = 'up' THEN 1 ELSE 0 END) as sitesUp,
        SUM(CASE WHEN latest.status = 'down' THEN 1 ELSE 0 END) as sitesDown
      FROM (
        SELECT website_id, status
        FROM uptime_logs l1
        WHERE checked_at = (
          SELECT MAX(checked_at) FROM uptime_logs l2 WHERE l2.website_id = l1.website_id
        )
      ) latest
    `);

    res.json({
      totalWebsites: websiteCount[0].count,
      sitesUp: currentStatus[0].sitesUp || 0,
      sitesDown: currentStatus[0].sitesDown || 0,
      totalChecks24h: logStats[0].totalChecks || 0,
      avgResponseTime: Math.round(logStats[0].avgResponseTime || 0),
      uptime24h: logStats[0].totalChecks > 0
        ? (logStats[0].upChecks / logStats[0].totalChecks * 100).toFixed(2)
        : 100
    });
  } finally {
    conn.release();
  }
}));

// ---------- Settings endpoints ----------
app.get('/api/settings/general', authMiddleware, asyncHandler(async (req, res) => {
  // Return current settings (stored in Redis or config)
  const settings = await redis.hgetall('settings:general') || {};
  res.json({
    defaultInterval: parseInt(settings.defaultInterval) || 60,
    maxConcurrentChecks: parseInt(settings.maxConcurrentChecks) || 200,
    requestTimeout: parseInt(settings.requestTimeout) || 5000,
    retryAttempts: parseInt(settings.retryAttempts) || 3
  });
}));

app.put('/api/settings/general', authMiddleware, asyncHandler(async (req, res) => {
  const { defaultInterval, maxConcurrentChecks, requestTimeout, retryAttempts } = req.body;
  await redis.hmset('settings:general', {
    defaultInterval: defaultInterval || 60,
    maxConcurrentChecks: maxConcurrentChecks || 200,
    requestTimeout: requestTimeout || 5000,
    retryAttempts: retryAttempts || 3
  });
  res.json({ message: 'Settings saved' });
}));

app.get('/api/settings/notifications', authMiddleware, asyncHandler(async (req, res) => {
  const settings = await redis.hgetall('settings:notifications') || {};
  res.json({
    emailEnabled: settings.emailEnabled === 'true',
    slackEnabled: settings.slackEnabled === 'true',
    webhookEnabled: settings.webhookEnabled === 'true',
    emailAddress: settings.emailAddress || '',
    slackWebhook: settings.slackWebhook || '',
    customWebhook: settings.customWebhook || '',
    notifyOnDown: settings.notifyOnDown !== 'false',
    notifyOnRecovery: settings.notifyOnRecovery !== 'false',
    notifyAfterMinutes: parseInt(settings.notifyAfterMinutes) || 5
  });
}));

app.put('/api/settings/notifications', authMiddleware, asyncHandler(async (req, res) => {
  const settings = req.body;
  await redis.hmset('settings:notifications', {
    emailEnabled: String(settings.emailEnabled || false),
    slackEnabled: String(settings.slackEnabled || false),
    webhookEnabled: String(settings.webhookEnabled || false),
    emailAddress: settings.emailAddress || '',
    slackWebhook: settings.slackWebhook || '',
    customWebhook: settings.customWebhook || '',
    notifyOnDown: String(settings.notifyOnDown !== false),
    notifyOnRecovery: String(settings.notifyOnRecovery !== false),
    notifyAfterMinutes: settings.notifyAfterMinutes || 5
  });
  res.json({ message: 'Notification settings saved' });
}));

// ---------- Serve static UI (Vue admin panel) ----------
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '../admin-panel/dist')));

// ---------- Server-Sent Events for live logs ----------
app.get('/api/logs/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send initial connection message
  res.write('data: {"type":"connected"}\n\n');

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

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    subscriber.unsubscribe('uptime:log');
    subscriber.disconnect();
  });
});

// ---------- Admin endpoint to kill pending jobs ----------
app.post('/api/admin/kill', authMiddleware, asyncHandler(async (req, res) => {
  const deleted = await redis.del('uptime:jobs');
  res.json({ status: 'jobs cleared', count: deleted });
}));

// ---------- Admin stats ----------
app.get('/api/admin/stats', authMiddleware, asyncHandler(async (req, res) => {
  const queueLength = await redis.llen('uptime:jobs');
  const settings = await redis.hgetall('settings:general') || {};

  res.json({
    queueLength,
    settings: {
      maxConcurrentChecks: parseInt(settings.maxConcurrentChecks) || 200,
      requestTimeout: parseInt(settings.requestTimeout) || 5000
    }
  });
}));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// SPA fallback - serve index.html for unmatched routes
app.get('*', (req, res) => {
  const adminPanelPath = path.join(__dirname, '../admin-panel/dist/index.html');
  const publicPath = path.join(__dirname, 'public/index.html');

  // Try admin panel first, then public folder
  res.sendFile(adminPanelPath, (err) => {
    if (err) {
      res.sendFile(publicPath, (err2) => {
        if (err2) {
          res.status(404).json({ error: 'Not found' });
        }
      });
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
  console.log(`Admin panel available at http://localhost:${PORT}`);
});
