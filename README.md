# Uptime Monitor

A high-performance, scalable uptime monitoring system built with Node.js, capable of monitoring **5,000+ websites** simultaneously with real-time updates.

![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![License](https://img.shields.io/badge/License-MIT-blue.svg)
![MySQL](https://img.shields.io/badge/MySQL-8.0+-orange.svg)
![Redis](https://img.shields.io/badge/Redis-7.0+-red.svg)

## Features

- **Real-time Monitoring** - Track website availability with configurable intervals
- **Live Dashboard** - Server-Sent Events (SSE) powered real-time updates
- **High Performance** - Connection pooling, DNS caching, and batch processing
- **Scalable Architecture** - Distributed job-queue system with separate scheduler and workers
- **Smart Fallback** - HTTP HEAD → HTTP GET → TCP connection check
- **Detailed Logging** - Response times, error reasons, and historical data
- **REST API** - Full CRUD operations for managing monitored websites

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       UPTIME MONITOR SYSTEM                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────────┐         ┌──────────────┐                        │
│   │  API Server  │         │  Scheduler   │                        │
│   │  (Port 3000) │         │  (60s loop)  │                        │
│   │              │         │              │                        │
│   │ • REST API   │         │ • Fetch URLs │                        │
│   │ • Dashboard  │         │ • Queue Jobs │                        │
│   │ • SSE Stream │         │              │                        │
│   └──────┬───────┘         └──────┬───────┘                        │
│          │                        │                                 │
│          │                        ▼                                 │
│          │                 ┌──────────────┐                        │
│          │                 │    REDIS     │                        │
│          │                 │              │                        │
│          │                 │ • Job Queue  │                        │
│          │                 │ • Pub/Sub    │                        │
│          │                 └──────┬───────┘                        │
│          │                        │                                 │
│          │                        ▼                                 │
│          │                 ┌──────────────┐                        │
│          │                 │   WORKER     │                        │
│          │                 │              │                        │
│          │                 │ • HTTP Check │                        │
│          │                 │ • TCP Check  │                        │
│          │                 │ • Store Logs │                        │
│          │                 └──────┬───────┘                        │
│          │                        │                                 │
│          ▼                        ▼                                 │
│   ┌─────────────────────────────────────────┐                      │
│   │                 MYSQL                    │                      │
│   │                                          │                      │
│   │  websites table    │   uptime_logs table │                      │
│   └─────────────────────────────────────────┘                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Node.js** | Runtime environment |
| **Express.js** | REST API framework |
| **MySQL** | Primary database |
| **Redis** | Job queue & pub/sub |
| **Undici** | High-performance HTTP client |
| **PM2** | Process management |

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **MySQL** (v8.0 or higher)
- **Redis** (v7.0 or higher)
- **npm** or **yarn**

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yogesh-joshi-0333/uptime-moniter-nodejs.git
cd uptime-moniter-nodejs
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure MySQL Database

Connect to MySQL and run the initialization script:

```bash
mysql -u root -p < db/init.sql
```

Or manually execute:

```sql
CREATE DATABASE IF NOT EXISTS sitechecker;
USE sitechecker;

CREATE TABLE IF NOT EXISTS websites (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  url VARCHAR(255) NOT NULL,
  interval_seconds INT NOT NULL DEFAULT 60,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS uptime_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  website_id BIGINT NOT NULL,
  status ENUM('up','down') NOT NULL,
  response_time_ms INT,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  error_reason TEXT,
  FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

### 4. Configure Environment Variables

Create a `.env` file in the root directory (optional - defaults are provided):

```env
# MySQL Configuration
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=sitechecker

# Redis Configuration
REDIS_URL=redis://127.0.0.1:6379

# API Server Configuration
PORT=3000

# Worker Configuration
MAX_CONCURRENT=200
BATCH_SIZE=100
REQUEST_TIMEOUT=5000
```

### 5. Start Redis Server

Make sure Redis is running:

```bash
# Ubuntu/Debian
sudo systemctl start redis-server

# macOS (using Homebrew)
brew services start redis

# Or run directly
redis-server
```

### 6. Start the Application

**Development Mode (all services):**

```bash
npm run dev
```

**Production Mode (individual services):**

```bash
# Terminal 1 - API Server
npm run start:api

# Terminal 2 - Scheduler
npm run start:scheduler

# Terminal 3 - Worker
npm run start:worker
```

### 7. Access the Dashboard

Open your browser and navigate to:

```
http://localhost:3000
```

## API Reference

### Websites

#### Add a Website

```http
POST /websites
Content-Type: application/json

{
  "url": "https://example.com",
  "interval_seconds": 60
}
```

**Response:**

```json
{
  "id": 1,
  "url": "https://example.com",
  "interval_seconds": 60
}
```

#### List All Websites

```http
GET /websites
```

**Response:**

```json
[
  {
    "id": 1,
    "url": "https://example.com",
    "interval_seconds": 60,
    "created_at": "2024-01-15T10:30:00.000Z"
  }
]
```

#### Delete a Website

```http
DELETE /websites/:id
```

### Logs

#### Get Uptime Logs

```http
GET /logs?website_id=1&limit=100
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `website_id` | integer | Filter by website ID |
| `limit` | integer | Number of records (default: 100) |

#### Stream Live Logs (SSE)

```http
GET /logs/stream
```

Returns a Server-Sent Events stream with real-time monitoring updates.

### Admin

#### Clear Job Queue

```http
POST /admin/kill
```

#### Health Check

```http
GET /health
```

## Project Structure

```
uptime-monitor-nodejs/
├── api/
│   └── server.js          # Express API server
├── scheduler/
│   └── index.js           # Job scheduling service
├── worker/
│   └── index.js           # Job processing service
├── db/
│   └── init.sql           # Database schema
├── public/
│   └── index.html         # Web dashboard
├── test/
│   ├── run_all.js         # E2E test runner
│   └── seed.js            # Database seeder
├── package.json
└── README.md
```

## Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `MYSQL_HOST` | localhost | MySQL server host |
| `MYSQL_USER` | root | MySQL username |
| `MYSQL_PASSWORD` | 12345 | MySQL password |
| `MYSQL_DATABASE` | sitechecker | Database name |
| `REDIS_URL` | redis://127.0.0.1:6379 | Redis connection URL |
| `PORT` | 3000 | API server port |
| `MAX_CONCURRENT` | 200 | Max parallel HTTP checks |
| `BATCH_SIZE` | 100 | Jobs pulled per cycle |
| `REQUEST_TIMEOUT` | 5000 | HTTP timeout (ms) |

## Performance Optimization

The system is optimized for high throughput:

- **Connection Pooling** - Undici agent with 200 persistent connections
- **DNS Caching** - 5-minute TTL to reduce DNS lookups
- **Batch Processing** - Process 100 jobs per cycle
- **Concurrency Control** - Throttle to prevent overwhelming targets
- **Smart Fallback** - HEAD → GET → TCP for reliable detection

## Testing

Run the end-to-end test suite:

```bash
npm test
```

Seed the database with sample websites:

```bash
node test/seed.js
```

## Scaling

To handle more websites, you can:

1. **Run Multiple Workers**
   ```bash
   # Terminal 1
   npm run start:worker

   # Terminal 2
   npm run start:worker
   ```

2. **Increase Concurrency**
   ```env
   MAX_CONCURRENT=500
   BATCH_SIZE=200
   ```

3. **Use PM2 for Process Management**
   ```bash
   pm2 start worker/index.js -i 4 --name "uptime-worker"
   ```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/yogesh-joshi-0333/uptime-moniter-nodejs/issues).

---

Made with :heart: by [Yogesh Joshi](https://devyogesh.com)
