const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const { authenticate, authorizeRoles } = require('../middleware/auth');

router.post('/', authenticate, authorizeRoles('employee'), requestController.createRequest);
router.get('/', authenticate, authorizeRoles('employee'), requestController.getMyRequests);
router.delete('/:id', authenticate, authorizeRoles('employee'), requestController.cancelRequest);

module.exports = router;
