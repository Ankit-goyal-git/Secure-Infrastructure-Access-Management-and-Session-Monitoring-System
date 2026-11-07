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

    // 3. Create test accounts
    const passwordHash = await bcrypt.hash('password123', 10);

    const employee = await User.create({
      name: 'Rahul',
      email: 'rahul@example.com',
      passwordHash,
      role: 'employee',
    });
    console.log(`Created Employee: ${employee.name} (${employee.email})`);

    const manager = await User.create({
      name: 'Manager Bob',
      email: 'boss@example.com',
      passwordHash,
      role: 'manager',
    });
    console.log(`Created Manager: ${manager.name} (${manager.email})`);

    const admin = await User.create({
      name: 'Admin Alice',
      email: 'admin@example.com',
      passwordHash,
      role: 'admin',
    });
    console.log(`Created Admin: ${admin.name} (${admin.email})`);

    // 4. Create mock target servers for testing
    const testServer = await Server.create({
      name: 'demo-server',
      host: 'target-server',
      port: 22,
      description: 'Development SSH server target',
      status: 'active',
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
