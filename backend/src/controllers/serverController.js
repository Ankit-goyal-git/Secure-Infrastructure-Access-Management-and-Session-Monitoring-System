const net = require('net');
const { Server } = require('../models');

// GET /api/servers
// Returns server catalog. Admins see all servers & metadata; Employees/Managers see active servers.
exports.getServers = async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const { all, department, status } = req.query;

    const whereClause = {};

    // Non-admins can only see active servers
    if (!isAdmin) {
      whereClause.status = 'active';
    } else if (status) {
      whereClause.status = status;
    } else if (all !== 'true') {
      // Default admin view shows active unless ?all=true is specified
      // But allow admin to see all servers if requested
    }

    if (department && department !== 'all') {
      whereClause.department = department;
    }

    const attributes = isAdmin
      ? ['id', 'name', 'host', 'port', 'description', 'status', 'department', 'sshUsername', 'sshPassword', 'sshKey', 'createdAt']
      : ['id', 'name', 'host', 'port', 'description', 'status', 'department'];

    const servers = await Server.findAll({
      where: whereClause,
      attributes,
      order: [['id', 'ASC']],
    });

    // For security, mask raw passwords in admin responses while exposing presence flags
    const sanitizedServers = servers.map((server) => {
      const data = server.toJSON();
      if (isAdmin) {
        data.hasPassword = !!data.sshPassword;
        data.hasKey = !!data.sshKey;
        delete data.sshPassword;
        delete data.sshKey;
      }
      return data;
    });

    return res.status(200).json(sanitizedServers);
  } catch (error) {
    console.error('Error fetching servers catalog:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// POST /api/servers (Admin Only)
// Creates a new dynamic target server without restarting backend services
exports.createServer = async (req, res) => {
  const {
    name,
    host,
    port,
    description,
    department,
    status,
    sshUsername,
    sshPassword,
    sshKey,
  } = req.body;

  if (!name || !host) {
    return res.status(400).json({ error: 'Server name and host are required fields.' });
  }

  const parsedPort = parseInt(port, 10) || 22;

  try {
    // Prevent duplicate server host/port records
    const existingServer = await Server.findOne({
      where: { host: host.trim(), port: parsedPort },
    });

    if (existingServer) {
      return res.status(409).json({
        error: `A server with host "${host}" and port "${parsedPort}" already exists (${existingServer.name}).`,
      });
    }

    const newServer = await Server.create({
      name: name.trim(),
      host: host.trim(),
      port: parsedPort,
      description: description ? description.trim() : null,
      department: department || 'engineering',
      status: status || 'active',
      sshUsername: sshUsername ? sshUsername.trim() : 'employee',
      sshPassword: sshPassword || null,
      sshKey: sshKey || null,
    });

    const responseData = newServer.toJSON();
    responseData.hasPassword = !!responseData.sshPassword;
    responseData.hasKey = !!responseData.sshKey;
    delete responseData.sshPassword;
    delete responseData.sshKey;

    return res.status(201).json({
      message: 'Server registered successfully.',
      server: responseData,
    });
  } catch (error) {
    console.error('Error creating new server:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// PUT /api/servers/:id (Admin Only)
// Updates an existing server's network config, department, or credentials
exports.updateServer = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    host,
    port,
    description,
    department,
    status,
    sshUsername,
    sshPassword,
    sshKey,
  } = req.body;

  try {
    const server = await Server.findByPk(id);

    if (!server) {
      return res.status(404).json({ error: 'Target server node not found.' });
    }

    // Check duplicate if host/port is being changed
    if (host || port) {
      const targetHost = host ? host.trim() : server.host;
      const targetPort = port ? parseInt(port, 10) : server.port;

      const conflict = await Server.findOne({
        where: { host: targetHost, port: targetPort },
      });

      if (conflict && String(conflict.id) !== String(id)) {
        return res.status(409).json({
          error: `Another server (${conflict.name}) is already registered at ${targetHost}:${targetPort}.`,
        });
      }

      server.host = targetHost;
      server.port = targetPort;
    }

    if (name) server.name = name.trim();
    if (description !== undefined) server.description = description ? description.trim() : null;
    if (department) server.department = department.trim();
    if (sshUsername) server.sshUsername = sshUsername.trim();

    if (status) {
      if (!['active', 'inactive', 'maintenance'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be active, inactive, or maintenance.' });
      }
      server.status = status;
    }

    // Update credentials only if explicitly passed (non-empty)
    if (sshPassword !== undefined && sshPassword !== '') {
      server.sshPassword = sshPassword;
    }
    if (sshKey !== undefined && sshKey !== '') {
      server.sshKey = sshKey;
    }

    await server.save();

    const responseData = server.toJSON();
    responseData.hasPassword = !!responseData.sshPassword;
    responseData.hasKey = !!responseData.sshKey;
    delete responseData.sshPassword;
    delete responseData.sshKey;

    return res.status(200).json({
      message: 'Server configuration updated successfully.',
      server: responseData,
    });
  } catch (error) {
    console.error('Error updating server details:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// DELETE /api/servers/:id (Admin Only)
// Soft-deactivates or deletes a server
exports.deleteServer = async (req, res) => {
  const { id } = req.params;
  const { permanent } = req.query;

  try {
    const server = await Server.findByPk(id);

    if (!server) {
      return res.status(404).json({ error: 'Target server node not found.' });
    }

    if (permanent === 'true' || permanent === '1') {
      try {
        await server.destroy();
        return res.status(200).json({ message: `Server "${server.name}" permanently deleted.` });
      } catch (destroyError) {
        // If foreign key constraint blocks deletion, fall back to soft-deactivation
        server.status = 'inactive';
        await server.save();
        return res.status(200).json({
          message: `Server "${server.name}" has existing access history and cannot be purged permanently; its status has been set to "inactive".`,
        });
      }
    } else {
      // Default: soft-deactivate
      server.status = 'inactive';
      await server.save();
      return res.status(200).json({
        message: `Server "${server.name}" deactivated successfully.`,
      });
    }
  } catch (error) {
    console.error('Error deleting server:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// POST /api/servers/test-connection (Admin Only)
// Tests live network and SSH reachability for a given host and port
exports.testConnection = async (req, res) => {
  const { host, port, timeoutMs = 4000 } = req.body;

  if (!host) {
    return res.status(400).json({ error: 'Host is required to test connectivity.' });
  }

  const parsedPort = parseInt(port, 10) || 22;
  const startTime = Date.now();

  const socket = new net.Socket();
  let isResolved = false;

  const cleanup = () => {
    socket.removeAllListeners();
    socket.destroy();
  };

  const timer = setTimeout(() => {
    if (!isResolved) {
      isResolved = true;
      cleanup();
      return res.status(200).json({
        success: false,
        host,
        port: parsedPort,
        reachable: false,
        latencyMs: Date.now() - startTime,
        error: `Connection timed out after ${timeoutMs}ms. Host or port is unreachable.`,
      });
    }
  }, timeoutMs);

  socket.connect(parsedPort, host, () => {
    // Connected! Now wait briefly for an SSH protocol banner (e.g. SSH-2.0-OpenSSH...)
  });

  socket.on('data', (data) => {
    if (!isResolved) {
      isResolved = true;
      clearTimeout(timer);
      const latencyMs = Date.now() - startTime;
      const banner = data.toString('utf8').trim().split('\n')[0] || '';
      cleanup();

      const isSSH = banner.startsWith('SSH-');
      return res.status(200).json({
        success: true,
        host,
        port: parsedPort,
        reachable: true,
        isSSH,
        banner: banner || 'TCP Port Open',
        latencyMs,
        message: isSSH
          ? `SSH service detected: ${banner} (${latencyMs}ms)`
          : `TCP port ${parsedPort} is open (${latencyMs}ms)`,
      });
    }
  });

  socket.on('error', (err) => {
    if (!isResolved) {
      isResolved = true;
      clearTimeout(timer);
      cleanup();
      return res.status(200).json({
        success: false,
        host,
        port: parsedPort,
        reachable: false,
        latencyMs: Date.now() - startTime,
        error: err.message,
        code: err.code,
      });
    }
  });
};
