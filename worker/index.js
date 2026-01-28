// worker/index.js
// Fully Optimized Worker with all performance enhancements:
// 1. True concurrency control with active counter + throttling
// 2. undici.Agent with connection pooling & pipelining
// 3. Batch processing (pull multiple jobs at once)
// 4. DNS caching to avoid repeated lookups
// 5. BATCH DB INSERTS to reduce MySQL connections

const Redis = require('ioredis');
const { Agent, request, setGlobalDispatcher } = require('undici');
const mysql = require('mysql2/promise');
const dns = require('dns');
const net = require('net');
const { URL } = require('url');

// ---------- Configuration ----------
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '12345',
  database: process.env.MYSQL_DATABASE || 'sitechecker',
  waitForConnections: true,
  connectionLimit: 20,  // Reduced from 1000 to 20
  queueLimit: 100,      // Queue requests instead of failing
  connectTimeout: 10000,
  acquireTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
};

const redis = new Redis(REDIS_URL);
const pool = mysql.createPool(MYSQL_CONFIG);

// ---------- Batch Insert Queue ----------
const insertQueue = [];
const BATCH_INSERT_SIZE = 50;      // Insert 50 records at once
const BATCH_INSERT_INTERVAL = 1000; // Or every 1 second
let batchInsertTimer = null;

async function flushInsertQueue() {
  if (insertQueue.length === 0) return;

  const batch = insertQueue.splice(0, BATCH_INSERT_SIZE);
  if (batch.length === 0) return;

  let conn;
  try {
    conn = await pool.getConnection();

    // Build batch insert query
    const placeholders = batch.map(() => '(?, ?, ?, NOW(), ?)').join(', ');
    const values = batch.flatMap(item => [
      item.websiteId,
      item.status,
      item.responseTime,
      item.errorReason
    ]);

    await conn.execute(
      `INSERT INTO uptime_logs (website_id, status, response_time_ms, checked_at, error_reason) VALUES ${placeholders}`,
      values
    );

    // Publish to Redis for SSE (batch publish)
    const pipeline = redis.pipeline();
    for (const item of batch) {
      pipeline.publish('uptime:log', JSON.stringify({
        websiteId: item.websiteId,
        url: item.url,
        status: item.status,
        responseTime: item.responseTime,
        errorReason: item.errorReason,
        checked_at: new Date().toISOString(),
      }));
    }
    await pipeline.exec();

  } catch (err) {
    console.error('Batch insert error:', err.message);
    // Re-queue failed items for retry (only once)
    if (batch[0] && !batch[0].retried) {
      batch.forEach(item => { item.retried = true; });
      insertQueue.push(...batch);
    }
  } finally {
    if (conn) conn.release();
  }
}

// Schedule periodic batch inserts
function startBatchInsertTimer() {
  if (batchInsertTimer) return;
  batchInsertTimer = setInterval(async () => {
    while (insertQueue.length > 0) {
      await flushInsertQueue();
    }
  }, BATCH_INSERT_INTERVAL);
}

// Queue a log entry for batch insert
function queueLogInsert(websiteId, url, status, responseTime, errorReason) {
  insertQueue.push({ websiteId, url, status, responseTime, errorReason });

  // Flush immediately if batch is full
  if (insertQueue.length >= BATCH_INSERT_SIZE) {
    flushInsertQueue();
  }
}

// ---------- DNS Caching ----------
const dnsCache = new Map();
const DNS_CACHE_TTL = 300000 * 12; // 60 minutes

function cachedLookup(hostname, options, callback) {
  const key = hostname;
  const cached = dnsCache.get(key);

  if (cached && Date.now() - cached.timestamp < DNS_CACHE_TTL) {
    return callback(null, cached.address, cached.family);
  }

  dns.lookup(hostname, options, (err, address, family) => {
    if (!err) {
      dnsCache.set(key, { address, family, timestamp: Date.now() });
    }
    callback(err, address, family);
  });
}

// ---------- Optimized HTTP Agent with Connection Pooling ----------
const agent = new Agent({
  keepAliveTimeout: 10000,
  keepAliveMaxTimeout: 30000,
  connections: 100,
  pipelining: 1,
  connect: {
    lookup: cachedLookup,
  },
});

setGlobalDispatcher(agent);

// ---------- Concurrency Control ----------
// Default values (will be overridden by Redis settings)
let MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT) || 100;
let BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 50;
let REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 5000;

let activeCount = 0;
let isShuttingDown = false;

// Load settings from Redis periodically
async function loadSettingsFromRedis() {
  try {
    const settings = await redis.hgetall('settings:general');
    if (settings && Object.keys(settings).length > 0) {
      if (settings.maxConcurrentChecks) {
        MAX_CONCURRENT = parseInt(settings.maxConcurrentChecks) || MAX_CONCURRENT;
      }
      if (settings.requestTimeout) {
        REQUEST_TIMEOUT = parseInt(settings.requestTimeout) || REQUEST_TIMEOUT;
      }
      console.log(`[Settings] Loaded from Redis: MAX_CONCURRENT=${MAX_CONCURRENT}, REQUEST_TIMEOUT=${REQUEST_TIMEOUT}ms`);
    }
  } catch (err) {
    console.error('Failed to load settings from Redis:', err.message);
  }
}

// Reload settings every 30 seconds
setInterval(loadSettingsFromRedis, 30000);

// ---------- In-memory timing stats ----------
const siteStats = new Map();
let totalJobs = 0;
let totalTimeMs = 0;
let batchCount = 0;
let totalUp = 0;
let totalDown = 0;
let fastestSite = { url: '', time: Infinity };
let slowestSite = { url: '', time: 0 };

function logJob(url, status, ms) {
  console.log(`[${new Date().toISOString()}] ${url} → ${status} in ${ms} ms`);
}

function updateStats(url, ms, status) {
  totalJobs++;
  totalTimeMs += ms;

  if (status === 'up') totalUp++;
  else totalDown++;

  if (ms < fastestSite.time) fastestSite = { url, time: ms };
  if (ms > slowestSite.time) slowestSite = { url, time: ms };

  const entry = siteStats.get(url) || { count: 0, totalTime: 0, upCount: 0, downCount: 0 };
  entry.count++;
  entry.totalTime += ms;
  if (status === 'up') entry.upCount++;
  else entry.downCount++;
  siteStats.set(url, entry);
}

function logSummary() {
  const uptimePercent = totalJobs ? ((totalUp / totalJobs) * 100).toFixed(1) : 0;
  const avgOverall = totalJobs ? (totalTimeMs / totalJobs).toFixed(2) : 0;

  console.log('\n' + '='.repeat(60));
  console.log('                    BATCH SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Checks: ${totalJobs}`);
  console.log(`UP: ${totalUp}  |  DOWN: ${totalDown}  |  Uptime: ${uptimePercent}%`);
  console.log(`Average Response: ${avgOverall} ms`);
  console.log(`Fastest: ${fastestSite.url} (${fastestSite.time} ms)`);
  console.log(`Slowest: ${slowestSite.url} (${slowestSite.time} ms)`);
  console.log(`Distinct Sites: ${siteStats.size}`);
  console.log(`Batches Processed: ${batchCount}`);
  console.log(`DB Queue Size: ${insertQueue.length}`);
  console.log(`Active Connections: ${pool.pool ? pool.pool._allConnections.length : 'N/A'}`);
  console.log('='.repeat(60) + '\n');
}

// ---------- TCP Connection Check ----------
function checkTcpConnection(hostname, port, timeout = 3000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, hostname);
  });
}

// ---------- Single Site Check ----------
async function checkSite(websiteId, url) {
  const start = Date.now();
  let status = 'up';
  let responseTime = null;
  let errorReason = null;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  };

  try {
    const res = await request(url, {
      method: 'HEAD',
      headers,
      headersTimeout: REQUEST_TIMEOUT,
      bodyTimeout: REQUEST_TIMEOUT,
      maxRedirections: 5,
    });
    responseTime = Date.now() - start;
    await res.body.dump();

    if (res.statusCode >= 200 && res.statusCode < 400) {
      status = 'up';
    } else if (res.statusCode === 403) {
      status = 'up';
    } else if (res.statusCode === 405) {
      throw new Error('HEAD_NOT_ALLOWED');
    } else {
      status = 'down';
      errorReason = `HTTP ${res.statusCode}`;
    }
  } catch (headErr) {
    try {
      const res = await request(url, {
        method: 'GET',
        headers,
        headersTimeout: REQUEST_TIMEOUT,
        bodyTimeout: REQUEST_TIMEOUT,
        maxRedirections: 5,
      });
      responseTime = Date.now() - start;
      await res.body.dump();

      if (res.statusCode >= 200 && res.statusCode < 400) {
        status = 'up';
      } else if (res.statusCode === 403) {
        status = 'up';
      } else {
        status = 'down';
        errorReason = `HTTP ${res.statusCode}`;
      }
    } catch (getErr) {
      try {
        const parsedUrl = new URL(url);
        const port = parsedUrl.protocol === 'https:' ? 443 : 80;
        const tcpUp = await checkTcpConnection(parsedUrl.hostname, port);

        if (tcpUp) {
          status = 'up';
          errorReason = 'HTTP blocked but TCP reachable';
        } else {
          status = 'down';
          errorReason = getErr.code || getErr.message;
        }
      } catch (tcpErr) {
        status = 'down';
        errorReason = getErr.code || getErr.message;
      }
      responseTime = Date.now() - start;
    }
  }

  logJob(url, status, responseTime);
  updateStats(url, responseTime, status);

  // Queue for batch insert instead of immediate insert
  queueLogInsert(websiteId, url, status, responseTime, errorReason);

  return { websiteId, url, status, responseTime };
}

// ---------- Batch Processor ----------
async function processBatch(jobs) {
  batchCount++;
  const batchStart = Date.now();

  const promises = jobs.map(async (jobStr) => {
    const job = JSON.parse(jobStr);
    activeCount++;
    try {
      return await checkSite(job.websiteId, job.url);
    } finally {
      activeCount--;
    }
  });

  const results = await Promise.allSettled(promises);
  const batchTime = Date.now() - batchStart;
  console.log(`[Batch ${batchCount}] Processed ${jobs.length} jobs in ${batchTime} ms (active: ${activeCount})`);

  return results;
}

// ---------- Worker Loop ----------
async function workerLoop() {
  console.log('Worker loop started...');
  startBatchInsertTimer();

  while (!isShuttingDown) {
    if (activeCount >= MAX_CONCURRENT) {
      await new Promise(r => setTimeout(r, 10));
      continue;
    }

    const availableSlots = MAX_CONCURRENT - activeCount;
    const pullCount = Math.min(availableSlots, BATCH_SIZE);

    const jobs = [];
    for (let i = 0; i < pullCount; i++) {
      const result = await redis.rpop('uptime:jobs');
      if (result) {
        jobs.push(result);
      } else {
        break;
      }
    }

    if (jobs.length === 0) {
      await new Promise(r => setTimeout(r, 500));
      continue;
    }

    processBatch(jobs).catch(err => console.error('Batch processing error:', err));
  }
}

// ---------- Startup ----------
async function startup() {
  // Load settings from Redis before starting
  await loadSettingsFromRedis();

  console.log('='.repeat(50));
  console.log('OPTIMIZED WORKER CONFIGURATION');
  console.log('='.repeat(50));
  console.log(`MAX_CONCURRENT: ${MAX_CONCURRENT}`);
  console.log(`BATCH_SIZE: ${BATCH_SIZE}`);
  console.log(`REQUEST_TIMEOUT: ${REQUEST_TIMEOUT} ms`);
  console.log(`DB_CONNECTION_LIMIT: ${MYSQL_CONFIG.connectionLimit}`);
  console.log(`DB_BATCH_INSERT_SIZE: ${BATCH_INSERT_SIZE}`);
  console.log('='.repeat(50));

  workerLoop();
}

startup();

// Periodic summary every minute
setInterval(logSummary, 60 * 1000);

// Graceful shutdown
async function shutdown() {
  console.log('\nShutting down gracefully...');
  isShuttingDown = true;

  // Clear batch insert timer
  if (batchInsertTimer) {
    clearInterval(batchInsertTimer);
  }

  // Flush remaining inserts
  console.log(`Flushing ${insertQueue.length} remaining log entries...`);
  while (insertQueue.length > 0) {
    await flushInsertQueue();
  }

  // Clear remaining jobs from Redis queue
  const remaining = await redis.del('uptime:jobs');
  console.log(`Cleared ${remaining} remaining jobs from queue.`);

  logSummary();

  // Wait for active jobs to finish
  const waitStart = Date.now();
  const waitInterval = setInterval(async () => {
    if (activeCount === 0 || Date.now() - waitStart > 5000) {
      clearInterval(waitInterval);

      // Close connections
      await pool.end();
      redis.disconnect();

      console.log('Worker shutdown complete.');
      process.exit(0);
    }
  }, 100);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
