const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
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
  eventType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'event_type',
  },
  eventData: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'event_data',
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'audit_logs',
  timestamps: false,
});

module.exports = AuditLog;
