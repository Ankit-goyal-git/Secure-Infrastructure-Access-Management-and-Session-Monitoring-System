const sequelize = require('../config/database');
const User = require('./User');
const Server = require('./Server');
const AccessRequest = require('./AccessRequest');
const AccessGrant = require('./AccessGrant');
const Session = require('./Session');
const AuditLog = require('./AuditLog');
const SecurityAlert = require('./SecurityAlert');

// Relationships

// AccessRequest
User.hasMany(AccessRequest, { foreignKey: 'userId', as: 'requests' });
AccessRequest.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Server.hasMany(AccessRequest, { foreignKey: 'serverId', as: 'requests' });
AccessRequest.belongsTo(Server, { foreignKey: 'serverId', as: 'server' });

// AccessGrant
User.hasMany(AccessGrant, { foreignKey: 'userId', as: 'grants' });
AccessGrant.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(AccessGrant, { foreignKey: 'approvedBy', as: 'approvedGrants' });
AccessGrant.belongsTo(User, { foreignKey: 'approvedBy', as: 'approver' });

Server.hasMany(AccessGrant, { foreignKey: 'serverId', as: 'grants' });
AccessGrant.belongsTo(Server, { foreignKey: 'serverId', as: 'server' });

AccessRequest.hasOne(AccessGrant, { foreignKey: 'requestId', as: 'grant' });
AccessGrant.belongsTo(AccessRequest, { foreignKey: 'requestId', as: 'request' });

// Session
AccessGrant.hasMany(Session, { foreignKey: 'grantId', as: 'sessions' });
Session.belongsTo(AccessGrant, { foreignKey: 'grantId', as: 'grant' });

User.hasMany(Session, { foreignKey: 'userId', as: 'sessions' });
Session.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Server.hasMany(Session, { foreignKey: 'serverId', as: 'sessions' });
Session.belongsTo(Server, { foreignKey: 'serverId', as: 'server' });

// AuditLog
Session.hasMany(AuditLog, { foreignKey: 'sessionId', as: 'logs' });
AuditLog.belongsTo(Session, { foreignKey: 'sessionId', as: 'session' });

User.hasMany(AuditLog, { foreignKey: 'userId', as: 'logs' });
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Server.hasMany(AuditLog, { foreignKey: 'serverId', as: 'logs' });
AuditLog.belongsTo(Server, { foreignKey: 'serverId', as: 'server' });

// SecurityAlert
Session.hasMany(SecurityAlert, { foreignKey: 'sessionId', as: 'alerts' });
SecurityAlert.belongsTo(Session, { foreignKey: 'sessionId', as: 'session' });

User.hasMany(SecurityAlert, { foreignKey: 'userId', as: 'alerts' });
SecurityAlert.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Server.hasMany(SecurityAlert, { foreignKey: 'serverId', as: 'alerts' });
SecurityAlert.belongsTo(Server, { foreignKey: 'serverId', as: 'server' });

module.exports = {
  sequelize,
  User,
  Server,
  AccessRequest,
  AccessGrant,
  Session,
  AuditLog,
  SecurityAlert,
};
