const express = require('express');
const router = express.Router();
const serverController = require('../controllers/serverController');
const { authenticate, authorizeRoles } = require('../middleware/auth');

// Public catalog for authenticated users (Employees / Managers see active; Admins can query all)
router.get('/', authenticate, serverController.getServers);

// Admin-only infrastructure operations
router.post('/test-connection', authenticate, authorizeRoles('admin'), serverController.testConnection);
router.post('/', authenticate, authorizeRoles('admin'), serverController.createServer);
router.put('/:id', authenticate, authorizeRoles('admin'), serverController.updateServer);
router.delete('/:id', authenticate, authorizeRoles('admin'), serverController.deleteServer);

module.exports = router;
