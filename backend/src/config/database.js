const { Sequelize } = require('sequelize');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is not defined in environment variables.');
  process.exit(1);
}

// Enable SSL automatically for Supabase, Neon, Render, or production cloud databases
const isCloudDb =
  process.env.NODE_ENV === 'production' ||
  databaseUrl.includes('supabase.com') ||
  databaseUrl.includes('render.com') ||
  databaseUrl.includes('sslmode=') ||
  databaseUrl.includes('neon.tech') ||
  databaseUrl.includes('pooler.supabase.com');

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    timestamps: false, // Explicitly false since we manage timestamp fields manually in schema
  },
  dialectOptions: isCloudDb
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      }
    : {},
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

module.exports = sequelize;
