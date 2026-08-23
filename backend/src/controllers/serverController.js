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

// POST /api/servers (Admin Only)
exports.createServer = async (req, res) => {
  const { name, host, port, description } = req.body;

  if (!name || !host) {
    return res.status(400).json({ error: 'name and host are required fields.' });
  }

  try {
    // Prevent duplicate server host/port records
    const existingServer = await Server.findOne({
      where: { host, port: port || 22 },
    });

    if (existingServer) {
      return res.status(409).json({ error: 'A server with this host and port configuration already exists.' });
    }

    const newServer = await Server.create({
      name,
      host,
      port: port || 22,
      description: description || null,
      status: 'active',
    });

    return res.status(201).json(newServer);
  } catch (error) {
    console.error('Error creating new server:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// PUT /api/servers/:id (Admin Only)
exports.updateServer = async (req, res) => {
  const { id } = req.params;
  const { name, host, port, description, status } = req.body;

  try {
    const server = await Server.findByPk(id);

    if (!server) {
      return res.status(404).json({ error: 'Target server node not found.' });
    }

    // Update fields
    if (name) server.name = name;
    if (host) server.host = host;
    if (port) server.port = port;
    if (description !== undefined) server.description = description;
    if (status) {
      if (!['active', 'inactive', 'maintenance'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status value. Must be active, inactive, or maintenance.' });
      }
      server.status = status;
    }

    await server.save();

    return res.status(200).json({
      message: 'Server configuration updated successfully.',
      server,
    });
  } catch (error) {
    console.error('Error updating server details:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
