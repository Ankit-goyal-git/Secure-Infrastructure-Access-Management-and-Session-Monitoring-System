const { AccessGrant, Server, Session, AuditLog, SecurityAlert } = require('../models');
const redisClient = require('../config/redis');

// 1. GET /internal/access/check?userId=X&serverId=Y
exports.checkAccess = async (req, res) => {
  const { userId, serverId } = req.query;

  if (!userId || !serverId) {
    return res.status(400).json({ error: 'userId and serverId are required query parameters.' });
  }

  try {
    const redisKey = `access:${userId}:${serverId}`;
    
    // Check Redis for active JIT grant cache
    const cachedGrantStr = await redisClient.get(redisKey);

    if (!cachedGrantStr) {
      return res.status(403).json({
        allowed: false,
        reason: 'No active access grant'
      });
    }

    const cachedGrant = JSON.parse(cachedGrantStr);

    // Fetch server target information from PostgreSQL to return routing host/port
    const server = await Server.findByPk(serverId);
    if (!server || server.status !== 'active') {
      return res.status(404).json({
        allowed: false,
        reason: 'Target server not found or inactive'
      });
    }

    return res.status(200).json({
      allowed: true,
      userId: parseInt(userId, 10),
      serverId: parseInt(serverId, 10),
      accessType: cachedGrant.accessType || 'ssh',
      expiresAt: cachedGrant.expiresAt,
      targetHost: server.host,
      targetPort: server.port
    });
  } catch (error) {
    console.error('Error checking internal authorization:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// 2. POST /internal/sessions/start
exports.startSession = async (req, res) => {
  const { sessionId, userId, serverId, startedAt } = req.body;

  if (!sessionId || !userId || !serverId) {
    return res.status(400).json({ error: 'sessionId, userId, and serverId are required in body.' });
  }

  try {
    // Find the active SQL grant authorizing this session
    const grant = await AccessGrant.findOne({
      where: { userId, serverId, status: 'active' },
      order: [['created_at', 'DESC']]
    });

    if (!grant) {
      return res.status(404).json({ error: 'No active access grant found for user and server.' });
    }

    // Create session record in PostgreSQL
    const session = await Session.create({
      id: sessionId,
      grantId: grant.id,
      userId,
      serverId,
      startedAt: startedAt || new Date(),
      status: 'active'
    });

    // Create Audit Log entry
    await AuditLog.create({
      sessionId: session.id,
      userId,
      serverId,
      eventType: 'SESSION_STARTED',
      eventData: { clientIp: req.ip },
      timestamp: session.startedAt
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error starting session:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// 3. POST /internal/sessions/end
exports.endSession = async (req, res) => {
  const { sessionId, endedAt, reason } = req.body;

  if (!sessionId || !reason) {
    return res.status(400).json({ error: 'sessionId and reason are required in body.' });
  }

  try {
    const session = await Session.findByPk(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    // Map reason enum values to session status
    let sessionStatus = 'completed';
    if (reason === 'access_expired') {
      sessionStatus = 'expired';
    } else if (reason === 'policy_violation') {
      sessionStatus = 'blocked';
    } else if (reason === 'gateway_error') {
      sessionStatus = 'terminated';
    }

    session.endedAt = endedAt || new Date();
    session.status = sessionStatus;
    session.terminationReason = reason;
    await session.save();

    // Create Audit Log entry
    await AuditLog.create({
      sessionId: session.id,
      userId: session.userId,
      serverId: session.serverId,
      eventType: 'SESSION_ENDED',
      eventData: { terminationReason: reason },
      timestamp: session.endedAt
    });

    // If session ended due to expiry, also mark the access grant as expired
    if (reason === 'access_expired') {
      await AccessGrant.update(
        { status: 'expired' },
        { where: { id: session.grantId } }
      );
      
      // Delete Redis cache key just in case it hasn't expired yet
      await redisClient.del(`access:${session.userId}:${session.serverId}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error ending session:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// 4. POST /internal/audit/events
exports.logAuditEvent = async (req, res) => {
  const { sessionId, userId, serverId, eventType, eventData, timestamp } = req.body;

  if (!eventType) {
    return res.status(400).json({ error: 'eventType is required.' });
  }

  try {
    await AuditLog.create({
      sessionId,
      userId,
      serverId,
      eventType,
      eventData: eventData || {},
      timestamp: timestamp || new Date()
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error saving audit log event:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// 5. POST /internal/security-events
exports.logSecurityEvent = async (req, res) => {
  const { sessionId, userId, serverId, rule, severity, description } = req.body;

  if (!rule || !severity || !description) {
    return res.status(400).json({ error: 'rule, severity, and description are required.' });
  }

  try {
    // Create Security Alert record
    await SecurityAlert.create({
      sessionId,
      userId,
      serverId,
      rule,
      severity,
      description,
      status: 'open'
    });

    // Create Audit Log security trail
    await AuditLog.create({
      sessionId,
      userId,
      serverId,
      eventType: 'SECURITY_ALERT',
      eventData: { rule, severity, description },
      timestamp: new Date()
    });

    // Auto-termination trigger for high-severity violations
    const shouldTerminate = ['high', 'critical'].includes(severity.toLowerCase());

    return res.status(200).json({
      success: true,
      terminateSession: shouldTerminate
    });
  } catch (error) {
    console.error('Error logging security event:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
