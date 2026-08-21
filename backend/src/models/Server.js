const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Server = sequelize.define('Server', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  host: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  port: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 22,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'active',
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at',
  },
}, {
  tableName: 'servers',
  timestamps: false,
});

module.exports = Server;
