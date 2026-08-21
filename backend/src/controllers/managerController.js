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
  const { duration } = req.body; // Duration override option

  if (!duration) {
    return res.status(400).json({ error: 'Duration (minutes) is required for approval.' });
  }

  try {
    const request = await AccessRequest.findByPk(id);

    if (!request) {
      return res.status(404).json({ error: 'Access request not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request is already processed.' });
    }

    // 1. Calculate time limits
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + duration * 60 * 1000);

    // 2. Update Access Request Status
    request.status = 'approved';
    await request.save();

    // 3. Create Access Grant entry in SQL
    const grant = await AccessGrant.create({
      requestId: request.id,
      userId: request.userId,
      serverId: request.serverId,
      approvedBy: req.user.id, // Logged in manager's user ID from JWT
      accessType: 'ssh',
      startedAt,
      expiresAt,
      status: 'active',
    });

    // 4. Cache authorization permissions in Redis with a matching TTL (seconds)
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

    return res.status(200).json({
      message: 'Access request denied',
      status: 'denied',
    });
  } catch (error) {
    console.error('Error processing access request denial:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
