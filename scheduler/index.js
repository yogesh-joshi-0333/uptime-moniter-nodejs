// scheduler/index.js
// Scheduler service: reads active websites from MySQL and enqueues check jobs into Redis.

const Redis = require('ioredis');
const mysql = require('mysql2/promise');

// Configuration – MySQL (use dedicated user)
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '12345',
  database: process.env.MYSQL_DATABASE || 'sitechecker',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const redis = new Redis(REDIS_URL);
const pool = mysql.createPool(MYSQL_CONFIG);

// Interval for the scheduler loop (in milliseconds)
const SCHEDULER_INTERVAL_MS = 60 * 1000; // run every minute

async function enqueueJobs() {
  try {
    const [rows] = await pool.query('SELECT id, url FROM websites WHERE interval_seconds > 0');
    for (const row of rows) {
      const job = JSON.stringify({ websiteId: row.id, url: row.url });
      await redis.lpush('uptime:jobs', job);
    }
    console.log(`Enqueued ${rows.length} jobs at ${new Date().toISOString()}`);
  } catch (err) {
    console.error('Scheduler error:', err);
  }
}

function startScheduler() {
  // Initial run
  enqueueJobs();
  // Repeat at defined interval
  setInterval(enqueueJobs, SCHEDULER_INTERVAL_MS);
}

startScheduler();
