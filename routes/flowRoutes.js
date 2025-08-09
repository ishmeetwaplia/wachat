// server/routes/flowRoutes.js
const express = require('express');
const router = express.Router({ mergeParams: true });
const flowController = require('../controllers/flowController');
const { protect } = require('../middleware/auth');
const {responseHandler} = require('../middleware/responseHandler');

router.post('/', protect, responseHandler(flowController.createController));
router.get('/', protect, responseHandler(flowController.getFlowsController));
router.get('/:flowId', protect, responseHandler(flowController.getFlowByIdController));
router.put('/:flowId', protect, responseHandler(flowController.updateFlowController));
router.delete('/:flowId', protect, responseHandler(flowController.deleteFlowByIdController));

// router.delete('/:flowId', protect, responseHandler(flowController.deleteFlowController));

module.exports = router;