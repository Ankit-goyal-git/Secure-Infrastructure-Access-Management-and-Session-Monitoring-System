const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { encryptCredential } = require('../utils/crypto');

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
  department: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'engineering',
  },
  sshUsername: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: 'employee',
    field: 'ssh_username',
  },
  sshKey: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'ssh_key',
    set(val) {
      if (val && typeof val === 'string' && val.trim() !== '') {
        this.setDataValue('sshKey', encryptCredential(val.trim()));
      } else {
        this.setDataValue('sshKey', null);
      }
    },
  },
  sshPassword: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'ssh_password',
    set(val) {
      if (val && typeof val === 'string' && val.trim() !== '') {
        this.setDataValue('sshPassword', encryptCredential(val.trim()));
      } else {
        this.setDataValue('sshPassword', null);
      }
    },
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
