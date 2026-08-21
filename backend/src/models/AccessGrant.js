const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AccessGrant = sequelize.define('AccessGrant', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  requestId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'request_id',
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
  approvedBy: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'approved_by',
  },
  accessType: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'ssh',
    field: 'access_type',
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'started_at',
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at',
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'active',
    validate: {
      isIn: [['active', 'expired', 'revoked']],
    },
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at',
  },
}, {
  tableName: 'access_grants',
  timestamps: false,
});

module.exports = AccessGrant;
