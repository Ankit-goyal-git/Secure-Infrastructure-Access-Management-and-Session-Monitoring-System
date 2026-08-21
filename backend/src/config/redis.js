const { createClient } = require('redis');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisClient = createClient({
  url: redisUrl,
});

redisClient.on('connect', () => {
  console.log('Redis Client connecting...');
});

redisClient.on('ready', () => {
  console.log('Redis Client connected and ready.');
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

// Immediately connect to Redis
redisClient.connect().catch((err) => {
  console.error('Failed to connect to Redis:', err);
});

module.exports = redisClient;
