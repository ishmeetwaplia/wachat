// server/controllers/conversationController.js
const conversationService = require('../services/conversationService');
const responseHandler = require('../middleware/responseHandler');

// @desc    Get all conversations for a project
// @route   GET /api/projects/:projectId/conversations
// @access  Private
exports.getConversationsController = async (req) => {
    return await conversationService.getConversationsForProject(req);
};

// @desc    Get messages for a specific conversation
// @route   GET /api/projects/:projectId/conversations/:conversationId/messages
// @access  Private
exports.getMessagesController = async (req) => {
    return await conversationService.getMessagesForConversation(req);
};

// @desc    Send a message within a conversation
// @route   POST /api/projects/:projectId/conversations/:conversationId/messages
// @access  Private
exports.sendMessageController = async (req) => {
    return await conversationService.sendMessageInConversation(req);
};

// @desc    Mark conversation as read
// @route   PUT /api/projects/:projectId/conversations/:conversationId/read
// @access  Private
exports.markConversationAsReadController = async (req) => {
    return await conversationService.markConversationAsRead(req);
};
