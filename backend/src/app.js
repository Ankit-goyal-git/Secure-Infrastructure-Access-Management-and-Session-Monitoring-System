require('dotenv').config();
const express = require('express');
const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

// Parsers
app.use(express.json());

// Mount routers
app.use('/api/auth', require('./routes/auth'));
app.use('/api/servers', require('./routes/servers'));
app.use('/api/access-requests', require('./routes/requests'));

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
    // In development, you can use { alter: true } or { force: false }
    await sequelize.sync({ force: false });
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
