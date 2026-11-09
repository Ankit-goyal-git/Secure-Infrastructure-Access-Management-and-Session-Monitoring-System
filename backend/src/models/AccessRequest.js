const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AccessRequest = sequelize.define('AccessRequest', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'user_id',
  },
  serverId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'server_id',
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  requestedDuration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'requested_duration',
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'approved', 'denied', 'cancelled', 'expired', 'revoked']],
    },
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at',
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'updated_at',
  },
}, {
  tableName: 'access_requests',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = AccessRequest;
