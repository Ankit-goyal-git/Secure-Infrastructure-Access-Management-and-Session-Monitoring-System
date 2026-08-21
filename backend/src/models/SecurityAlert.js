const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SecurityAlert = sequelize.define('SecurityAlert', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  sessionId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'session_id',
  },
  userId: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'user_id',
  },
  serverId: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'server_id',
  },
  rule: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  severity: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['low', 'medium', 'high', 'critical']],
    },
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'open',
    validate: {
      isIn: [['open', 'reviewed', 'resolved']],
    },
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at',
  },
}, {
  tableName: 'security_alerts',
  timestamps: false,
});

module.exports = SecurityAlert;
