const { AccessRequest, Server } = require('../models');

exports.createRequest = async (req, res) => {
  const { serverId, duration, reason } = req.body;

  if (!serverId || !duration || !reason) {
    return res.status(400).json({ error: 'serverId, duration, and reason are required.' });
  }

  try {
    // 1. Verify target server exists and is active
    const server = await Server.findByPk(serverId);
    if (!server || server.status !== 'active') {
      return res.status(404).json({ error: 'Target server not found or inactive.' });
    }

    // 2. Prevent overlapping active or pending requests for the same server
    const existingRequest = await AccessRequest.findOne({
      where: {
        userId: req.user.id,
        serverId,
        status: 'pending',
      },
    });

    if (existingRequest) {
      return res.status(409).json({
        error: 'You already have a pending access request for this server.',
      });
    }

    const { AccessGrant } = require('../models');
    const existingGrant = await AccessGrant.findOne({
      where: {
        userId: req.user.id,
        serverId,
        status: 'active',
      },
      order: [['created_at', 'DESC']],
    });

    if (existingGrant) {
      if (new Date(existingGrant.expiresAt) <= new Date()) {
        // Expired TTL - clean up SQL status
        existingGrant.status = 'expired';
        await existingGrant.save().catch(() => {});
      } else {
        return res.status(409).json({
          error: 'You already have an active grant for this server.',
        });
      }
    }

    // 2. Create the request in the database
    const request = await AccessRequest.create({
      userId: req.user.id,
      serverId,
      reason,
      requestedDuration: duration,
      status: 'pending',
    });

    // 3. Return matching response contract format
    return res.status(201).json({
      id: request.id,
      serverId: request.serverId,
      serverName: server.name,
      requestedDuration: request.requestedDuration,
      reason: request.reason,
      status: request.status,
      createdAt: request.createdAt,
    });
  } catch (error) {
    console.error('Error creating access request:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getMyRequests = async (req, res) => {
  try {
    const { AccessGrant } = require('../models');
    const requests = await AccessRequest.findAll({
      where: { userId: req.user.id },
      include: [
        {
          model: Server,
          as: 'server',
          attributes: ['name', 'host', 'port', 'department'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    // Map to API response shapes format while reconciling grant status in real-time
    const now = new Date();
    const formatted = await Promise.all(
      requests.map(async (reqItem) => {
        let currentStatus = reqItem.status;

        // If marked approved, verify if underlying grant was revoked or expired
        if (currentStatus === 'approved') {
          const grant = await AccessGrant.findOne({
            where: { requestId: reqItem.id },
            order: [['created_at', 'DESC']],
          });

          if (grant) {
            if (grant.status === 'revoked') {
              currentStatus = 'revoked';
              // Self-heal request status in database
              reqItem.status = 'revoked';
              await reqItem.save().catch(() => {});
            } else if (new Date(grant.expiresAt) <= now) {
              currentStatus = 'expired';
            }
          }
        }

        return {
          id: reqItem.id,
          userId: reqItem.userId,
          serverId: reqItem.serverId,
          serverName: reqItem.server ? reqItem.server.name : 'Unknown Server',
          serverHost: reqItem.server ? reqItem.server.host : null,
          serverPort: reqItem.server ? reqItem.server.port : 22,
          department: reqItem.server ? reqItem.server.department : null,
          requestedDuration: reqItem.requestedDuration,
          reason: reqItem.reason,
          status: currentStatus,
          createdAt: reqItem.createdAt,
        };
      })
    );

    return res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching employee requests history:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
