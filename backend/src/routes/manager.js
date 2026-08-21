const express = require('express');
const router = express.Router();
const managerController = require('../controllers/managerController');
const { authenticate, authorizeRoles } = require('../middleware/auth');

// Manager operations endpoints (restricted to manager and admin roles)
router.get('/access-requests', authenticate, authorizeRoles('manager', 'admin'), managerController.getPendingRequests);
router.post('/access-requests/:id/approve', authenticate, authorizeRoles('manager', 'admin'), managerController.approveRequest);
router.post('/access-requests/:id/deny', authenticate, authorizeRoles('manager', 'admin'), managerController.denyRequest);

module.exports = router;
