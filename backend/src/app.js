require('dotenv').config();
const express = require('express');
const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS headers for cross-origin communication from Vercel / frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Parsers
app.use(express.json());

// Mount routers
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/servers', require('./routes/servers'));
app.use('/api/access-requests', require('./routes/requests'));
app.use('/api/manager', require('./routes/manager'));
app.use('/api/audit', require('./routes/audit'));
app.use('/internal', require('./routes/internal'));

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Database Synchronization & Server Bootstrap
const startServer = async () => {
  try {
    // Authenticate connection
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');

    // Sync all defined models to the DB
    await sequelize.sync({ alter: true });
    console.log('Database tables synchronized successfully.');

    app.listen(PORT, () => {
      console.log(`Backend Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to connect/sync to the database:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
