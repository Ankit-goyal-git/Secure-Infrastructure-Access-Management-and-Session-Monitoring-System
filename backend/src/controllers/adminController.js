const bcrypt = require('bcryptjs');
const { User, AccessRequest, AccessGrant, Session } = require('../models');

// GET /api/admin/users
exports.getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'name', 'email', 'role', 'createdAt', 'updatedAt'],
      order: [['id', 'ASC']],
    });

    // Aggregate stats per user
    const formatted = await Promise.all(
      users.map(async (u) => {
        const [requestsCount, activeGrantsCount] = await Promise.all([
          AccessRequest.count({ where: { userId: u.id } }).catch(() => 0),
          AccessGrant.count({ where: { userId: u.id, status: 'active' } }).catch(() => 0),
        ]);

        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          requestsCount,
          activeGrantsCount,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        };
      })
    );

    return res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching users catalog for admin:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// PATCH /api/admin/users/:id/role
exports.updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  const validRoles = ['employee', 'manager', 'admin'];
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({
      error: `Invalid role specified. Must be one of: ${validRoles.join(', ')}`,
    });
  }

  try {
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Safety guard: prevent logged-in admin from demoting their own account
    if (parseInt(req.user.id, 10) === parseInt(id, 10) && role !== 'admin') {
      return res.status(400).json({
        error: 'You cannot remove your own admin privileges. Have another admin change your role.',
      });
    }

    const previousRole = user.role;
    user.role = role;
    await user.save();

    console.log(`Admin ${req.user.email} updated User #${user.id} (${user.email}) role from '${previousRole}' to '${role}'`);

    return res.status(200).json({
      message: `User role successfully updated to ${role}`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// POST /api/admin/users
exports.createUser = async (req, res) => {
  const { name, email, password, role = 'employee' } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const validRoles = ['employee', 'manager', 'admin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      error: `Invalid role specified. Must be one of: ${validRoles.join(', ')}`,
    });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  try {
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'A user with this email address already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name,
      email,
      passwordHash,
      role,
    });

    console.log(`Admin ${req.user.email} created new user: ${newUser.name} (${newUser.email}) as [${newUser.role}]`);

    return res.status(201).json({
      message: `User ${newUser.name} successfully created with role ${newUser.role}`,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating user by admin:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// DELETE /api/admin/users/:id
exports.deleteUser = async (req, res) => {
  const { id } = req.params;

  // Prevent admin from deleting themselves
  if (parseInt(req.user.id, 10) === parseInt(id, 10)) {
    return res.status(400).json({ error: 'You cannot delete your own active admin account.' });
  }

  try {
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const targetEmail = user.email;
    await user.destroy();

    console.log(`Admin ${req.user.email} deleted user #${id} (${targetEmail})`);

    return res.status(200).json({
      message: `User account (${targetEmail}) has been deleted.`,
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({
      error: 'Cannot delete user with active historical logs or references. Consider changing their password or role.',
    });
  }
};

