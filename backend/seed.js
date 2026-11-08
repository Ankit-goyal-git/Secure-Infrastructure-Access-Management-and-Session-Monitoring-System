require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, User, Server } = require('./src/models');

const seedDatabase = async () => {
  try {
    // 1. Sync database (ensure tables and columns exist)
    await sequelize.sync({ alter: true });
    console.log('Database synced successfully.');

    // 2. Clear existing entries to prevent duplication errors on re-run and reset IDs
    await sequelize.query('TRUNCATE TABLE users, servers, access_requests, access_grants, sessions, audit_logs, security_alerts RESTART IDENTITY CASCADE;');
    console.log('Existing tables cleared and sequences reset.');

    // 3. Create test accounts with DIFFERENT passwords to verify individual authentication
    const rahulHash = await bcrypt.hash('rahulPass123!', 10);
    const priyaHash = await bcrypt.hash('priyaSecure456#', 10);
    const bobHash = await bcrypt.hash('bobManager789$', 10);
    const aliceHash = await bcrypt.hash('adminMaster999@', 10);

    const employee1 = await User.create({
      name: 'Rahul (DevOps)',
      email: 'rahul@example.com',
      passwordHash: rahulHash,
      role: 'employee',
    });
    console.log(`Created Employee 1 (ID ${employee1.id}): ${employee1.name} (Password: rahulPass123!)`);

    const employee2 = await User.create({
      name: 'Priya (Backend Dev)',
      email: 'priya@example.com',
      passwordHash: priyaHash,
      role: 'employee',
    });
    console.log(`Created Employee 2 (ID ${employee2.id}): ${employee2.name} (Password: priyaSecure456#)`);

    const manager = await User.create({
      name: 'Manager Bob',
      email: 'boss@example.com',
      passwordHash: bobHash,
      role: 'manager',
    });
    console.log(`Created Manager (ID ${manager.id}): ${manager.name} (Password: bobManager789$)`);

    const admin = await User.create({
      name: 'Admin Alice',
      email: 'admin@example.com',
      passwordHash: aliceHash,
      role: 'admin',
    });
    console.log(`Created Admin (ID ${admin.id}): ${admin.name} (Password: adminMaster999@)`);

    // 4. Create mock target servers for testing
    const testServer = await Server.create({
      name: 'demo-server',
      host: 'target-server',
      port: 22,
      description: 'Development SSH server target',
      status: 'active',
      department: 'engineering',
      sshUsername: 'employee',
      sshPassword: 'employee123',
    });
    console.log(`Created Test Server: ${testServer.name} (${testServer.host}:${testServer.port})`);

    const dbServer = await Server.create({
      name: 'db-prod-01',
      host: 'target-server',
      port: 22,
      description: 'Primary PostgreSQL Database Node',
      status: 'active',
      department: 'infrastructure',
      sshUsername: 'employee',
      sshPassword: 'employee123',
    });
    console.log(`Created Test Server: ${dbServer.name} (${dbServer.host}:${dbServer.port})`);

    const appServer = await Server.create({
      name: 'payment-service-node',
      host: 'target-server',
      port: 22,
      description: 'Payment Microservice Cluster Node',
      status: 'active',
      department: 'finance',
      sshUsername: 'employee',
      sshPassword: 'employee123',
    });
    console.log(`Created Test Server: ${appServer.name} (${appServer.host}:${appServer.port})`);

    console.log('Database seeding completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed database:', error);
    process.exit(1);
  }
};

seedDatabase();
