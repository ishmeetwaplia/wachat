// server/routes/conversation.js
const express = require('express');
const { protect } = require('../middleware/auth');
const {responseHandler} = require('../middleware/responseHandler');
const conversationController = require('../controllers/conversationController');

const router = express.Router({ mergeParams: true }); // mergeParams to get projectId from parent route

// Get all conversations for a specific project
router.get("/", protect, responseHandler(conversationController.getConversationsController));

// Get messages for a specific conversation within a project
router.get("/:conversationId/messages", protect, responseHandler(conversationController.getMessagesController));

// Send a message within a specific conversation
router.post("/:conversationId/messages", protect, responseHandler(conversationController.sendMessageController));

// Mark a conversation as read
router.put("/:conversationId/read", protect, responseHandler(conversationController.markConversationAsReadController));

module.exports = router;
