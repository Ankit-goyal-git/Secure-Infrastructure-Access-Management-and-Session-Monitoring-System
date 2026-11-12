const { createClient } = require('redis');
require('dotenv').config();

let redisUrl = (process.env.REDIS_URL || 'redis://localhost:6379').trim();

// Auto-clean CLI wrapper if copied from Upstash CLI tab (e.g. redis-cli --tls -u redis://...)
if (redisUrl.includes('-u ')) {
  redisUrl = redisUrl.split('-u ').pop().trim();
}

// Strip surrounding quotes if present
redisUrl = redisUrl.replace(/^['"]|['"]$/g, '');

// Ensure TLS rediss:// protocol for cloud instances like Upstash
if (redisUrl.includes('upstash.io') && redisUrl.startsWith('redis://')) {
  redisUrl = redisUrl.replace('redis://', 'rediss://');
}

const isTls = redisUrl.startsWith('rediss://');

const redisClient = createClient({
  url: redisUrl,
  socket: isTls
    ? {
        tls: true,
        rejectUnauthorized: false,
      }
    : undefined,
});

redisClient.on('connect', () => {
  console.log('Redis Client connecting...');
});

redisClient.on('ready', () => {
  console.log('Redis Client connected and ready.');
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err.message);
});

// Immediately connect to Redis
redisClient.connect().catch((err) => {
  console.error('Failed to connect to Redis:', err.message);
});

module.exports = redisClient;
