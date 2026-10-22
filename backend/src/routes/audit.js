const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { AuditLog, User, Server } = require('../models');
const { authenticate } = require('../middleware/auth');

// GET /api/audit/events
router.get('/events', authenticate, async (req, res) => {
  try {
    const logs = await AuditLog.findAll({
      order: [['timestamp', 'DESC']],
      limit: 100,
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
    });

    const formatted = logs.map((log) => {
      let result = 'ALLOWED';
      const eventType = log.eventType || '';
      if (
        eventType.includes('BLOCKED') ||
        eventType.includes('ALERT') ||
        eventType.includes('FAILED')
      ) {
        result = 'BLOCKED';
      } else if (eventType.includes('EXPIRED') || eventType.includes('REVOKED')) {
        result = 'TERMINATED';
      }

      return {
        event_id: log.id,
        timestamp: log.timestamp,
        event_type: log.eventType,
        session_id: log.sessionId,
        user_id: log.user ? `${log.user.name} (#${log.user.id})` : `User #${log.userId || 'N/A'}`,
        server_id: log.server ? `${log.server.name} (#${log.server.id})` : `Server #${log.serverId || 'N/A'}`,
        raw_user_id: log.userId,
        raw_server_id: log.serverId,
        result: result,
        metadata: log.eventData || {},
      };
    });

    return res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/audit/sessions/:id/recording
router.get('/sessions/:id/recording', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const filePath = path.join(__dirname, '../../recordings', `${id}.cast`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Session recording not found.' });
    }
    const content = fs.readFileSync(filePath, 'utf8');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(content);
  } catch (error) {
    console.error('Error fetching session replay recording:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
