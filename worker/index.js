// worker/index.js
// Fully Optimized Worker with all performance enhancements:
// 1. True concurrency control with active counter + throttling
// 2. undici.Agent with connection pooling & pipelining
// 3. Batch processing (pull multiple jobs at once)
// 4. DNS caching to avoid repeated lookups

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
  connectionLimit: 20,
  queueLimit: 0,
};

const redis = new Redis(REDIS_URL);
const pool = mysql.createPool(MYSQL_CONFIG);

// ---------- DNS Caching (built-in Node.js) ----------
// Cache DNS results for 5 minutes
const dnsCache = new Map();
const DNS_CACHE_TTL = 300000*12; // 5 minutes

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
  keepAliveTimeout: 10000,       // 10s keep-alive
  keepAliveMaxTimeout: 30000,    // max 30s
  connections: 200,              // max 200 concurrent connections per origin
  pipelining: 1,                 // HTTP pipelining enabled
  connect: {
    lookup: cachedLookup,        // Use cached DNS lookups
  },
});

// Set as global dispatcher for all requests
setGlobalDispatcher(agent);

// ---------- Concurrency Control ----------
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT) || 200;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 100;
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 5000;

let activeCount = 0;
let isShuttingDown = false;

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
  console.log(`📊 Total Checks: ${totalJobs}`);
  console.log(`✅ UP: ${totalUp}  |  ❌ DOWN: ${totalDown}  |  📈 Uptime: ${uptimePercent}%`);
  console.log(`⏱️  Average Response: ${avgOverall} ms`);
  console.log(`🚀 Fastest: ${fastestSite.url} (${fastestSite.time} ms)`);
  console.log(`🐢 Slowest: ${slowestSite.url} (${slowestSite.time} ms)`);
  console.log(`🔢 Distinct Sites: ${siteStats.size}`);
  console.log(`📦 Batches Processed: ${batchCount}`);
  console.log('='.repeat(60) + '\n');
}

// ---------- TCP Connection Check (most reliable) ----------
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

// ---------- Single Site Check (HEAD → GET → TCP fallback) ----------
async function checkSite(websiteId, url) {
  const start = Date.now();
  let status = 'up';
  let responseTime = null;
  let errorReason = null;

  // Common headers to look like a real browser
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  };

  // Try HEAD first (faster)
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
    
    // 2xx, 3xx = UP, 403 = UP (blocking bots but online), 4xx/5xx = DOWN
    if (res.statusCode >= 200 && res.statusCode < 400) {
      status = 'up';
    } else if (res.statusCode === 403) {
      status = 'up'; // Site is up but blocking automated requests
    } else {
      status = 'down';
      errorReason = `HTTP ${res.statusCode}`;
    }
  } catch (headErr) {
    // HEAD failed - try GET as fallback
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
      
      // 2xx, 3xx = UP, 403 = UP (blocking bots but online), 4xx/5xx = DOWN
      if (res.statusCode >= 200 && res.statusCode < 400) {
        status = 'up';
      } else if (res.statusCode === 403) {
        status = 'up'; // Site is up but blocking automated requests
      } else {
        status = 'down';
        errorReason = `HTTP ${res.statusCode}`;
      }
    } catch (getErr) {
      // Both HEAD and GET failed - try TCP connection as final check
      try {
        const parsedUrl = new URL(url);
        const port = parsedUrl.protocol === 'https:' ? 443 : 80;
        const tcpUp = await checkTcpConnection(parsedUrl.hostname, port);
        
        if (tcpUp) {
          status = 'up'; // Server is reachable via TCP
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

  // Log and update stats
  logJob(url, status, responseTime);
  updateStats(url, responseTime, status);

  // Persist to MySQL (non-blocking pattern)

  // Persist to MySQL (non-blocking pattern)
  pool.execute(
    'INSERT INTO uptime_logs (website_id, status, response_time_ms, checked_at, error_reason) VALUES (?, ?, ?, NOW(), ?)',
    [websiteId, status, responseTime, errorReason]
  ).then(() => {
    // Publish for live SSE stream
    redis.publish('uptime:log', JSON.stringify({
      websiteId,
      url,
      status,
      responseTime,
      errorReason,
      checked_at: new Date().toISOString(),
    }));
  }).catch(dbErr => {
    console.error('DB insert error:', dbErr.message);
  });

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
  
  // Show summary after every batch as requested
  logSummary();
  
  return results;
}

// ---------- Worker Loop with True Throttling ----------
async function workerLoop() {
  console.log('Worker loop started...');
  
  while (!isShuttingDown) {
    // TRUE CONCURRENCY CONTROL: Wait if at max capacity
    if (activeCount >= MAX_CONCURRENT) {
      await new Promise(r => setTimeout(r, 10)); // Small delay, check again
      continue;
    }

    // Calculate available slots
    const availableSlots = MAX_CONCURRENT - activeCount;
    const pullCount = Math.min(availableSlots, BATCH_SIZE);

    // BATCH PROCESSING: Pull multiple jobs at once
    const jobs = [];
    for (let i = 0; i < pullCount; i++) {
      const result = await redis.rpop('uptime:jobs');
      if (result) {
        jobs.push(result);
      } else {
        break; // No more jobs in queue
      }
    }

    if (jobs.length === 0) {
      // No jobs available, wait before checking again
      await new Promise(r => setTimeout(r, 500));
      continue;
    }

    // Fire batch processing (don't await to allow continuous pulling)
    processBatch(jobs).catch(err => console.error('Batch processing error:', err));
  }
}

// ---------- Startup ----------
console.log('='.repeat(50));
console.log('OPTIMIZED WORKER CONFIGURATION');
console.log('='.repeat(50));
console.log(`MAX_CONCURRENT: ${MAX_CONCURRENT}`);
console.log(`BATCH_SIZE: ${BATCH_SIZE}`);
console.log(`REQUEST_TIMEOUT: ${REQUEST_TIMEOUT} ms`);
console.log(`DNS_CACHE_TTL: 300 seconds`);
console.log(`CONNECTION_POOL: 200 connections`);
console.log(`KEEP_ALIVE: 10 seconds`);
console.log('='.repeat(50));

workerLoop();

// Periodic summary every minute
setInterval(logSummary, 60 * 1000);

// Graceful shutdown - clears job queue so nothing continues after stop
async function shutdown() {
  console.log('\nShutting down gracefully...');
  isShuttingDown = true;
  
  // Clear remaining jobs from Redis queue
  const remaining = await redis.del('uptime:jobs');
  console.log(`Cleared ${remaining} remaining jobs from queue.`);
  
  logSummary();
  
  // Wait for active jobs to finish (max 3 seconds)
  const waitStart = Date.now();
  const waitInterval = setInterval(() => {
    if (activeCount === 0 || Date.now() - waitStart > 3000) {
      clearInterval(waitInterval);
      console.log('Worker shutdown complete.');
      redis.disconnect();
      process.exit(0);
    }
  }, 100);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
