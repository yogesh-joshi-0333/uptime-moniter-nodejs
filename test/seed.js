// test/seed.js
// Seed dummy data into MySQL for the uptime monitoring system.

const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '12345',
    database: 'sitechecker',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
  });

    const dummyWebsites = [
        { url: 'https://example.com', interval_seconds: 60 },
    ];
  const conn = await pool.getConnection();
  try {
    // Clean existing data
    await conn.query('DELETE FROM uptime_logs');
    await conn.query('DELETE FROM websites');
    // Insert dummy websites
    for (const site of dummyWebsites) {
      await conn.execute(
        'INSERT INTO websites (url, interval_seconds) VALUES (?, ?)',
        [site.url, site.interval_seconds]
      );
    }
    console.log('✅ Dummy website data inserted.');
  } finally {
    conn.release();
    await pool.end();
  }
})();
