const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Session = sequelize.define('Session', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  grantId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'grant_id',
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
  startedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'started_at',
  },
  endedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'ended_at',
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'active',
    validate: {
      isIn: [['active', 'completed', 'terminated', 'expired', 'blocked']],
    },
  },
  terminationReason: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'termination_reason',
    validate: {
      isIn: [['user_disconnect', 'access_expired', 'security_policy', 'admin_termination', 'gateway_error', null]],
    },
  },
}, {
  tableName: 'sessions',
  timestamps: false,
});

module.exports = Session;
