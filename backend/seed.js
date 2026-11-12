require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, User, Server, AccessRequest, AccessGrant, Session, AuditLog } = require('./src/models');

const seedDatabase = async () => {
  try {
    // 1. Sync database schema
    await sequelize.sync({ alter: true });
    console.log('Database synced successfully.');

    // 2. Clear all previous tables & reset auto-increment sequences
    await sequelize.query('TRUNCATE TABLE users, servers, access_requests, access_grants, sessions, audit_logs, security_alerts RESTART IDENTITY CASCADE;');
    console.log('All previous test tables cleared and sequences reset.');

    // 3. Create core enterprise roles
    const rahulHash = await bcrypt.hash('rahulPass123!', 10);
    const priyaHash = await bcrypt.hash('priyaSecure456#', 10);
    const bobHash = await bcrypt.hash('bobManager789$', 10);

    const adminEmail = (process.env.ADMIN_EMAIL || 'goyalankitgoyal32@gmail.com').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'AnkitAdmin2026!';
    const adminName = process.env.ADMIN_NAME || 'Ankit Goyal (Admin)';
    const adminHash = await bcrypt.hash(adminPassword, 10);

    const employee1 = await User.create({
      name: 'Rahul (DevOps)',
      email: 'rahul@example.com',
      passwordHash: rahulHash,
      role: 'employee',
    });
    console.log(`Created Employee 1 (ID ${employee1.id}): ${employee1.name}`);

    const employee2 = await User.create({
      name: 'Priya (Backend Dev)',
      email: 'priya@example.com',
      passwordHash: priyaHash,
      role: 'employee',
    });
    console.log(`Created Employee 2 (ID ${employee2.id}): ${employee2.name}`);

    const manager = await User.create({
      name: 'Manager Bob',
      email: 'boss@example.com',
      passwordHash: bobHash,
      role: 'manager',
    });
    console.log(`Created Manager (ID ${manager.id}): ${manager.name}`);

    const admin = await User.create({
      name: adminName,
      email: adminEmail,
      passwordHash: adminHash,
      role: 'admin',
    });
    console.log(`Created Admin (ID ${admin.id}): ${admin.name} (${admin.email})`);

    // 4. Create target production nodes
    const testServer = await Server.create({
      name: 'demo-server',
      host: 'target-server-1',
      port: 22,
      description: 'Primary Staging Bastion Target Node',
      status: 'active',
      department: 'engineering',
      sshUsername: 'employee',
      sshPassword: 'employee123',
    });

    const dbServer = await Server.create({
      name: 'db-prod-01',
      host: 'target-server-2',
      port: 22,
      description: 'Primary PostgreSQL Database Cluster',
      status: 'active',
      department: 'infrastructure',
      sshUsername: 'employee',
      sshPassword: 'employee123',
    });

    const appServer = await Server.create({
      name: 'payment-service-node',
      host: 'target-server-3',
      port: 22,
      description: 'Payment Microservice Cluster Node',
      status: 'active',
      department: 'finance',
      sshUsername: 'employee',
      sshPassword: 'employee123',
    });

    // 5. Seed 2 Realistic Past Audit Records (linked to preserved recordings)
    const pastDate1 = new Date(Date.now() - 3600 * 1000 * 2); // 2 hours ago
    const pastDate2 = new Date(Date.now() - 3600 * 1000 * 4); // 4 hours ago

    // Request 1: Rahul on demo-server
    const req1 = await AccessRequest.create({
      userId: employee1.id,
      serverId: testServer.id,
      reason: 'Routine inspection of systemd logs and container statuses.',
      requestedDuration: 30,
      status: 'expired',
      createdAt: pastDate2,
    });

    const grant1 = await AccessGrant.create({
      requestId: req1.id,
      userId: employee1.id,
      serverId: testServer.id,
      approvedBy: manager.id,
      accessType: 'ssh',
      startedAt: pastDate2,
      expiresAt: new Date(pastDate2.getTime() + 30 * 60 * 1000),
      status: 'expired',
    });

    const session1Id = 'c954b98e-81e7-46b8-8797-f8d2c2ab5558';
    await Session.create({
      id: session1Id,
      grantId: grant1.id,
      userId: employee1.id,
      serverId: testServer.id,
      startedAt: pastDate2,
      endedAt: new Date(pastDate2.getTime() + 12 * 60 * 1000),
      status: 'completed',
      terminationReason: 'client_exit',
    });

    await AuditLog.bulkCreate([
      {
        sessionId: session1Id,
        userId: employee1.id,
        serverId: testServer.id,
        eventType: 'SESSION_STARTED',
        eventData: { clientIp: '192.168.1.10', durationMinutes: 30 },
        timestamp: pastDate2,
      },
      {
        sessionId: session1Id,
        userId: employee1.id,
        serverId: testServer.id,
        eventType: 'COMMAND_EXECUTED',
        eventData: { command: 'systemctl status nginx', exitCode: 0 },
        timestamp: new Date(pastDate2.getTime() + 180 * 1000),
      },
      {
        sessionId: session1Id,
        userId: employee1.id,
        serverId: testServer.id,
        eventType: 'SESSION_RECORDED',
        eventData: { recordingFile: `${session1Id}.cast`, sizeBytes: 3080 },
        timestamp: new Date(pastDate2.getTime() + 720 * 1000),
      },
      {
        sessionId: session1Id,
        userId: employee1.id,
        serverId: testServer.id,
        eventType: 'SESSION_ENDED',
        eventData: { reason: 'client_exit' },
        timestamp: new Date(pastDate2.getTime() + 720 * 1000),
      },
    ]);

    // Request 2: Priya on db-prod-01
    const req2 = await AccessRequest.create({
      userId: employee2.id,
      serverId: dbServer.id,
      reason: 'Verify PostgreSQL query latency and index fragmentation.',
      requestedDuration: 15,
      status: 'expired',
      createdAt: pastDate1,
    });

    const grant2 = await AccessGrant.create({
      requestId: req2.id,
      userId: employee2.id,
      serverId: dbServer.id,
      approvedBy: manager.id,
      accessType: 'ssh',
      startedAt: pastDate1,
      expiresAt: new Date(pastDate1.getTime() + 15 * 60 * 1000),
      status: 'expired',
    });

    const session2Id = '522cde8e-367f-4bcd-bf0f-c1ede75acdee';
    await Session.create({
      id: session2Id,
      grantId: grant2.id,
      userId: employee2.id,
      serverId: dbServer.id,
      startedAt: pastDate1,
      endedAt: new Date(pastDate1.getTime() + 8 * 60 * 1000),
      status: 'completed',
      terminationReason: 'client_exit',
    });

    await AuditLog.bulkCreate([
      {
        sessionId: session2Id,
        userId: employee2.id,
        serverId: dbServer.id,
        eventType: 'SESSION_STARTED',
        eventData: { clientIp: '192.168.1.44', durationMinutes: 15 },
        timestamp: pastDate1,
      },
      {
        sessionId: session2Id,
        userId: employee2.id,
        serverId: dbServer.id,
        eventType: 'COMMAND_EXECUTED',
        eventData: { command: 'uptime && df -h', exitCode: 0 },
        timestamp: new Date(pastDate1.getTime() + 120 * 1000),
      },
      {
        sessionId: session2Id,
        userId: employee2.id,
        serverId: dbServer.id,
        eventType: 'SESSION_RECORDED',
        eventData: { recordingFile: `${session2Id}.cast`, sizeBytes: 735 },
        timestamp: new Date(pastDate1.getTime() + 480 * 1000),
      },
      {
        sessionId: session2Id,
        userId: employee2.id,
        serverId: dbServer.id,
        eventType: 'SESSION_ENDED',
        eventData: { reason: 'client_exit' },
        timestamp: new Date(pastDate1.getTime() + 480 * 1000),
      },
    ]);

    console.log('Seeded 2 pristine audit records with keystroke recordings.');
    console.log('Database seeding completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed database:', error);
    process.exit(1);
  }
};

seedDatabase();
