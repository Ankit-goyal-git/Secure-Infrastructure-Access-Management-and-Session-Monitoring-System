const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');
const redisClient = require('../config/redis');
const { sendOtpEmail } = require('../utils/emailService');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// In-memory fallback cache for OTPs if Redis is unreachable
const memoryOtpCache = new Map();

const setOtpCache = async (key, data, ttlSeconds = 600) => {
  try {
    if (redisClient.isReady) {
      await redisClient.set(key, JSON.stringify(data), { EX: ttlSeconds });
      return;
    }
  } catch (err) {
    console.warn(`Redis write failed for ${key}, using memory fallback:`, err.message);
  }

  // Memory fallback
  memoryOtpCache.set(key, data);
  setTimeout(() => memoryOtpCache.delete(key), ttlSeconds * 1000);
};

const getOtpCache = async (key) => {
  try {
    if (redisClient.isReady) {
      const raw = await redisClient.get(key);
      if (raw) return JSON.parse(raw);
    }
  } catch (err) {
    console.warn(`Redis read failed for ${key}, checking memory fallback:`, err.message);
  }

  return memoryOtpCache.get(key) || null;
};

const deleteOtpCache = async (key) => {
  try {
    if (redisClient.isReady) {
      await redisClient.del(key);
    }
  } catch (err) {
    // Ignore error
  }
  memoryOtpCache.delete(key);
};

// 1. POST /api/auth/login (Standard Email + Password)
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error during login operation:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// 2. POST /api/auth/send-login-otp (Trigger Gmail OTP for existing user)
exports.sendLoginOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    const user = await User.findOne({ where: { email: cleanEmail } });
    if (!user) {
      return res.status(404).json({ error: 'No account registered with this email address.' });
    }

    // Generate 6-digit cryptographic OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // Cache in Redis / Memory for 10 minutes
    const key = `otp:login:${cleanEmail}`;
    await setOtpCache(key, { otp, userId: user.id }, 600);

    // Send email via Gmail SMTP
    await sendOtpEmail(cleanEmail, otp, 'Login Verification');

    return res.status(200).json({
      success: true,
      message: `A 6-digit security code has been sent to ${cleanEmail}`,
    });
  } catch (error) {
    console.error('Error sending login OTP:', error);
    return res.status(500).json({ error: 'Failed to dispatch verification email.' });
  }
};

// 3. POST /api/auth/verify-login-otp (Verify Gmail OTP & Log In)
exports.verifyLoginOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and 6-digit verification code are required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanOtp = otp.toString().trim();

  try {
    const key = `otp:login:${cleanEmail}`;
    const cached = await getOtpCache(key);

    if (!cached || cached.otp !== cleanOtp) {
      return res.status(401).json({ error: 'Invalid or expired verification code. Please request a new code.' });
    }

    // Code verified: delete used OTP
    await deleteOtpCache(key);

    // Fetch user details
    const user = await User.findByPk(cached.userId);
    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      message: 'Authentication successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error verifying login OTP:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// 4. POST /api/auth/send-register-otp (Trigger Gmail OTP for new account creation)
exports.sendRegisterOtp = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    const existing = await User.findOne({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Pre-hash password before caching
    const passwordHash = await bcrypt.hash(password, 10);
    const otp = crypto.randomInt(100000, 999999).toString();

    // Cache registration context for 10 minutes
    const key = `otp:register:${cleanEmail}`;
    await setOtpCache(key, { name: name.trim(), email: cleanEmail, passwordHash, otp }, 600);

    await sendOtpEmail(cleanEmail, otp, 'Account Registration');

    return res.status(200).json({
      success: true,
      message: `A 6-digit verification code has been sent to ${cleanEmail}`,
    });
  } catch (error) {
    console.error('Error sending registration OTP:', error);
    return res.status(500).json({ error: 'Failed to dispatch verification email.' });
  }
};

// 5. POST /api/auth/verify-register-otp (Verify Gmail OTP & Create Account)
exports.verifyRegisterOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and verification code are required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanOtp = otp.toString().trim();

  try {
    const key = `otp:register:${cleanEmail}`;
    const cached = await getOtpCache(key);

    if (!cached || cached.otp !== cleanOtp) {
      return res.status(401).json({ error: 'Invalid or expired verification code. Please request a new code.' });
    }

    // Code verified: delete used OTP
    await deleteOtpCache(key);

    // Re-check existing in case of race condition
    const existing = await User.findOne({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Create user with default role 'employee' (can be promoted to manager/admin by Admin)
    const user = await User.create({
      name: cached.name,
      email: cached.email,
      passwordHash: cached.passwordHash,
      role: 'employee',
    });

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      message: 'Account verified and created successfully.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error verifying registration OTP:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// 6. POST /api/auth/register (Standard Direct Registration)
exports.register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    const existingUser = await User.findOne({ where: { email: cleanEmail } });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role: 'employee',
    });

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error during registration operation:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// 7. GET /api/auth/me (Current Session Profile)
exports.me = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error('Error fetching authenticated profile:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
