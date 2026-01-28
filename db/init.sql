-- MySQL schema for Uptime Monitoring System
-- Database: sitechecker

CREATE DATABASE IF NOT EXISTS sitechecker;
USE sitechecker;

-- Table to store monitored websites
CREATE TABLE IF NOT EXISTS websites (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  url VARCHAR(255) NOT NULL,
  name VARCHAR(255) DEFAULT NULL,
  interval_seconds INT NOT NULL DEFAULT 60,
  notification_email VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Table to store uptime logs
CREATE TABLE IF NOT EXISTS uptime_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  website_id BIGINT NOT NULL,
  status ENUM('up','down') NOT NULL,
  response_time_ms INT,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  error_reason TEXT,
  FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
) ENGINE=InnoDB;
