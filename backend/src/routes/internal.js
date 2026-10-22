const express = require('express');
const router = express.Router();
const gatewayController = require('../controllers/gatewayController');
const { validateApiKey } = require('../middleware/auth');

// Apply internal API Key protection middleware globally across all gateway routes
router.use(validateApiKey);

router.get('/access/check', gatewayController.checkAccess);
router.post('/access/check', gatewayController.checkAccess);
router.post('/sessions/start', gatewayController.startSession);
router.post('/sessions/end', gatewayController.endSession);
router.post('/sessions/:id/recording', gatewayController.saveRecording);
router.get('/sessions/:id/recording', gatewayController.getRecording);
router.post('/audit/events', gatewayController.logAuditEvent);
router.post('/security-events', gatewayController.logSecurityEvent);

module.exports = router;
