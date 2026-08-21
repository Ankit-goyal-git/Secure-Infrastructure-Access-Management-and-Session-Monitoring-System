const { Server } = require('../models');

exports.getServers = async (req, res) => {
  try {
    const servers = await Server.findAll({
      where: { status: 'active' },
      attributes: ['id', 'name', 'host', 'port', 'description', 'status'],
    });

    return res.status(200).json(servers);
  } catch (error) {
    console.error('Error fetching servers catalog:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
