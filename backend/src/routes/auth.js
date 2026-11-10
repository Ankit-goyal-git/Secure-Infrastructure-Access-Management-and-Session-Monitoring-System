const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Standard Password Auth
router.post('/login', authController.login);
router.post('/register', authController.register);

// Gmail OTP Two-Factor & Passwordless Auth
router.post('/send-login-otp', authController.sendLoginOtp);
router.post('/verify-login-otp', authController.verifyLoginOtp);
router.post('/send-register-otp', authController.sendRegisterOtp);
router.post('/verify-register-otp', authController.verifyRegisterOtp);

// Authenticated session profile
router.get('/me', authenticate, authController.me);

module.exports = router;
