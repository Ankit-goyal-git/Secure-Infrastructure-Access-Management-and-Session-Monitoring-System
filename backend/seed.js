require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, User, Server } = require('./src/models');

const seedDatabase = async () => {
  try {
    // 1. Sync database (ensure tables exist)
    await sequelize.sync({ force: false });
    console.log('Database synced successfully.');

    // 2. Clear existing entries to prevent duplication errors on re-run
    await User.destroy({ where: {}, truncate: { cascade: true } });
    await Server.destroy({ where: {}, truncate: { cascade: true } });
    console.log('Existing users and servers cleared.');

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

    // 4. Create a mock target server for testing
    const testServer = await Server.create({
      name: 'demo-server',
      host: 'target-server',
      port: 22,
      description: 'Development SSH server target',
      status: 'active',
    });
    console.log(`Created Test Server: ${testServer.name} (${testServer.host}:${testServer.port})`);

    console.log('Database seeding completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed database:', error);
    process.exit(1);
  }
};

seedDatabase();
