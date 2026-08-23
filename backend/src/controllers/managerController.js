const { AccessRequest, AccessGrant, User, Server } = require('../models');
const redisClient = require('../config/redis');

exports.getPendingRequests = async (req, res) => {
  try {
    const requests = await AccessRequest.findAll({
      where: { status: 'pending' },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email'],
        },
        {
          model: Server,
          as: 'server',
          attributes: ['id', 'name'],
        },
      ],
      order: [['created_at', 'ASC']],
    });

    // Formatting output matching REST contracts specification
    const formatted = requests.map(reqItem => ({
      id: reqItem.id,
      user: reqItem.user ? {
        id: reqItem.user.id,
        name: reqItem.user.name,
        email: reqItem.user.email
      } : null,
      server: reqItem.server ? {
        id: reqItem.server.id,
        name: reqItem.server.name
      } : null,
      requestedDuration: reqItem.requestedDuration,
      reason: reqItem.reason,
      status: reqItem.status,
      createdAt: reqItem.createdAt
    }));

    return res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching pending requests for manager:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.approveRequest = async (req, res) => {
  const { id } = req.params;
  const { duration, approvalReason } = req.body; 

  if (!duration || !approvalReason) {
    return res.status(400).json({ error: 'duration and approvalReason are required for approval.' });
  }

  try {
    const request = await AccessRequest.findByPk(id);

    if (!request) {
      return res.status(404).json({ error: 'Access request not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request is already processed.' });
    }

    // 1. Prevent self-approval (security control)
    if (parseInt(request.userId, 10) === parseInt(req.user.id, 10)) {
      return res.status(403).json({ error: 'Self-approval is forbidden. Another manager must review this request.' });
    }

    // 2. Prevent manager from overriding duration beyond the employee's requested limit
    if (parseInt(duration, 10) > parseInt(request.requestedDuration, 10)) {
      return res.status(400).json({ error: 'Approved duration cannot exceed the requested duration.' });
    }

    // 3. Calculate time limits
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + duration * 60 * 1000);

    // 4. Update Access Request Status
    request.status = 'approved';
    await request.save();

    // 5. Create Access Grant entry in SQL
    const grant = await AccessGrant.create({
      requestId: request.id,
      userId: request.userId,
      serverId: request.serverId,
      approvedBy: req.user.id, 
      accessType: 'ssh',
      startedAt,
      expiresAt,
      status: 'active',
    });

    // 6. Write Audit Log entry with approval reason context
    const { AuditLog } = require('../models');
    await AuditLog.create({
      userId: request.userId,
      serverId: request.serverId,
      eventType: 'ACCESS_APPROVED',
      eventData: {
        requestId: request.id,
        approvedBy: req.user.id,
        approvedDuration: duration,
        approvalReason: approvalReason,
      },
      timestamp: startedAt,
    });

    // 7. Cache authorization permissions in Redis with a matching TTL (seconds)
    const redisKey = `access:${request.userId}:${request.serverId}`;
    const redisValue = JSON.stringify({
      userId: parseInt(request.userId, 10),
      serverId: parseInt(request.serverId, 10),
      accessType: 'ssh',
      expiresAt: expiresAt.toISOString(),
    });

    // Set Redis key with EX option (TTL in seconds)
    await redisClient.set(redisKey, redisValue, {
      EX: duration * 60,
    });

    console.log(`Redis grant cache written for Key: ${redisKey} with TTL: ${duration * 60}s`);

    return res.status(200).json({
      message: 'Access request approved',
      grant: {
        id: grant.id,
        userId: grant.userId,
        serverId: grant.serverId,
        accessType: grant.accessType,
        startedAt,
        expiresAt,
        status: grant.status,
      },
    });
  } catch (error) {
    console.error('Error processing access request approval:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.denyRequest = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({ error: 'Denial reason note is required.' });
  }

  try {
    const request = await AccessRequest.findByPk(id);

    if (!request) {
      return res.status(404).json({ error: 'Access request not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request is already processed.' });
    }

    // Update request status to denied
    request.status = 'denied';
    await request.save();

    // Log the denial event
    const { AuditLog } = require('../models');
    await AuditLog.create({
      userId: request.userId,
      serverId: request.serverId,
      eventType: 'ACCESS_REJECTED',
      eventData: {
        requestId: request.id,
        deniedBy: req.user.id,
        denialReason: reason,
      },
      timestamp: new Date(),
    });

    return res.status(200).json({
      message: 'Access request denied',
      status: 'denied',
    });
  } catch (error) {
    console.error('Error processing access request denial:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// POST /api/manager/access-grants/:id/revoke
exports.revokeGrant = async (req, res) => {
  const { id } = req.params;

  try {
    const grant = await AccessGrant.findByPk(id);

    if (!grant) {
      return res.status(404).json({ error: 'Access grant not found.' });
    }

    if (grant.status !== 'active') {
      return res.status(400).json({ error: 'Grant is not active.' });
    }

    // 1. Revoke SQL status
    grant.status = 'revoked';
    await grant.save();

    // 2. Evict cache from Redis immediately
    const redisKey = `access:${grant.userId}:${grant.serverId}`;
    await redisClient.del(redisKey);
    console.log(`Redis key ${redisKey} evicted due to admin revocation.`);

    // 3. Mark any running active gateway sessions matching this grant as terminated
    const { Session, AuditLog } = require('../models');
    const activeSessions = await Session.findAll({
      where: { grantId: grant.id, status: 'active' },
    });

    for (const session of activeSessions) {
      session.status = 'terminated';
      session.endedAt = new Date();
      session.terminationReason = 'admin_termination';
      await session.save();

      // Log session end event
      await AuditLog.create({
        sessionId: session.id,
        userId: session.userId,
        serverId: session.serverId,
        eventType: 'SESSION_ENDED',
        eventData: { terminationReason: 'admin_termination', revokedBy: req.user.id },
        timestamp: session.endedAt,
      });
    }

    // 4. Log the overall access revocation event
    await AuditLog.create({
      userId: grant.userId,
      serverId: grant.serverId,
      eventType: 'ACCESS_REVOKED',
      eventData: {
        grantId: grant.id,
        revokedBy: req.user.id,
      },
      timestamp: new Date(),
    });

    return res.status(200).json({
      message: 'Access grant successfully revoked and sessions terminated.',
      status: 'revoked',
    });
  } catch (error) {
    console.error('Error revoking access grant:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
