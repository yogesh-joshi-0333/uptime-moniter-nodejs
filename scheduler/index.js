// scheduler/index.js
// Scheduler service: reads active websites from MySQL and enqueues check jobs into Redis.
// Respects individual website check intervals.

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

// Base interval for the scheduler loop (in milliseconds)
const SCHEDULER_INTERVAL_MS = 10 * 1000; // check every 10 seconds

// Track last check time for each website
const lastCheckTime = new Map();

async function enqueueJobs() {
  try {
    const now = Date.now();
    const [rows] = await pool.query('SELECT id, url, name, interval_seconds FROM websites WHERE interval_seconds > 0');

    let enqueuedCount = 0;
    for (const row of rows) {
      const intervalMs = row.interval_seconds * 1000;
      const lastCheck = lastCheckTime.get(row.id) || 0;

      // Only enqueue if enough time has passed since last check
      if (now - lastCheck >= intervalMs) {
        const job = JSON.stringify({
          websiteId: row.id,
          url: row.url,
          name: row.name || null
        });
        await redis.lpush('uptime:jobs', job);
        lastCheckTime.set(row.id, now);
        enqueuedCount++;
      }
    }

    if (enqueuedCount > 0) {
      console.log(`[${new Date().toISOString()}] Enqueued ${enqueuedCount} jobs (${rows.length} total websites)`);
    }
  } catch (err) {
    console.error('Scheduler error:', err);
  }
}

// Load default interval from Redis settings
async function loadDefaultInterval() {
  try {
    const settings = await redis.hgetall('settings:general');
    if (settings && settings.defaultInterval) {
      console.log(`Default check interval: ${settings.defaultInterval} seconds`);
    }
  } catch (err) {
    console.error('Failed to load settings:', err.message);
  }
}

async function startScheduler() {
  console.log('='.repeat(50));
  console.log('SCHEDULER STARTED');
  console.log('='.repeat(50));
  console.log(`Check frequency: every ${SCHEDULER_INTERVAL_MS / 1000} seconds`);
  console.log('Individual website intervals are respected');
  console.log('='.repeat(50));

  await loadDefaultInterval();

  // Initial run
  await enqueueJobs();

  // Repeat at defined interval
  setInterval(enqueueJobs, SCHEDULER_INTERVAL_MS);
}

startScheduler();
