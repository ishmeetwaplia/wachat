const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    userId: { // The user who initiated/owns the message (project owner, or admin who sent it)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true
    },
    conversationId: { // NEW: Link to the specific conversation
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: false, // Can be null if it's a direct send outside a known conversation
        index: true
    },
     bulkSendJobId: { // NEW: Link to BulkSendJob
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BulkSendJob',
        index: true, // Index for fast lookup of messages within a bulk job
        sparse: true // Allows null for single messages
    },
    metaPhoneNumberID: { // NEW: The Meta Phone Number ID used for sending/receiving
        type: String,
        trim: true,
        required: false, // Required for actual WhatsApp messages, but might be generic for internal messages
        index: true
    },
    to: { // Recipient phone number (for outbound messages)
        type: String,
        trim: true
    },
    from: { // Sender phone number (for inbound messages)
        type: String,
        trim: true
    },
    direction: { // 'inbound' or 'outbound'
        type: String,
        enum: ['inbound', 'outbound'],
        required: true
    },
    type: { // Message type: 'text', 'template', 'image', 'document', 'audio', 'video', 'sticker', 'reaction', 'location', 'contacts'
        type: String,
        required: true
    },
    message: { // The actual message content (structured as per Meta's API for different types)
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    metaMessageId: { // The message ID assigned by Meta (useful for status updates)
        type: String,
        trim: true,
        sparse: true, // Allows null values
        index: true
    },
    status: { // 'sent', 'delivered', 'read', 'failed', 'received' (for inbound)
        type: String,
        enum: ['sent', 'delivered', 'read', 'failed', 'received', 'queued', 'pending'],
        default: 'pending' // Initial status for outbound messages, 'received' for inbound
    },
    metaResponse: { // Store the full Meta API response for outbound messages
        type: mongoose.Schema.Types.Mixed
    },
    errorDetails: { // Store error details if message sending failed
        type: mongoose.Schema.Types.Mixed
    },
    sentAt: { // When the message was sent/received
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

MessageSchema.index({ conversationId: 1, sentAt: 1 }); // For efficient message retrieval in a conversation
MessageSchema.index({ projectId: 1, direction: 1, sentAt: 1 }); // For filtering messages by project/direction

MessageSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    if (this.isNew) {
        this.sentAt = Date.now(); // Set sentAt only on creation
    }
    next();
});

module.exports = mongoose.model('Message', MessageSchema);
