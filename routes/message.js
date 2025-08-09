const express = require('express');
const {responseHandler} = require('../middleware/responseHandler');
const { protect } = require('../middleware/auth');
const uploadExcel = require('../config/multerConfig');
const mediaUploadDir = require('../config/multerMediaConfig');
const messageController=require('../controllers/messageController');
const { sendGroupMessageLimiter } = require('../middleware/rateLimiter');
const validateRequest = require("../middleware/validate");
const messageValidation = require("../validations/messageValidations");
const router = express.Router({ mergeParams: true });

router.post("/send", protect, validateRequest(messageValidation.sendMessage), responseHandler(messageController.sendMessageController));
router.post("/bulk-messages", protect, uploadExcel.single("file"), responseHandler(messageController.sendBulkMessageController));
router.post('/upload-media', protect, mediaUploadDir.single('file'), responseHandler(messageController.uploadMedia));
router.get('/bulk-send-jobs', protect, responseHandler(messageController.getAllBulkSendJobsService));
router.get('/bulk-send-jobs/:bulkSendJobId', protect, responseHandler(messageController.getBulkSendJobDetailsService));
router.post('/bulk-send-group', protect, sendGroupMessageLimiter, responseHandler(messageController.BulkSendGroupController));
router.post('/download-media', protect, messageController.downloadMediaController);
// router.post('/download-media', protect, messageController.downloadMediaControllerRaw); // ❌ not wrapped in responseHandler

module.exports = router;