const express = require('express');
const router = express.Router();
const serverController = require('../controllers/serverController');
const { authenticate, authorizeRoles } = require('../middleware/auth');

router.get('/', authenticate, serverController.getServers);
router.post('/', authenticate, authorizeRoles('admin'), serverController.createServer);
router.put('/:id', authenticate, authorizeRoles('admin'), serverController.updateServer);

module.exports = router;
