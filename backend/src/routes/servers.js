const express = require('express');
const router = express.Router();
const serverController = require('../controllers/serverController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, serverController.getServers);

module.exports = router;
