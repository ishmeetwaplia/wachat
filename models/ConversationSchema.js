const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    userId: { // The user who owns this conversation (the project owner's ID)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    projectId: { // Link to the project this conversation belongs to
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true
    },
    contactId: { // The recipient contact of this conversation
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contact',
        required: true,
        index: true
    },
    metaPhoneNumberID: { // The specific Meta Phone Number ID that is interacting with this contact
        type: String,
        required: true,
        trim: true,
        index: true
    },
    lastActivityAt: { // Timestamp of the latest message (inbound or outbound)
        type: Date,
        default: Date.now,
        index: true
    },
    latestMessage: { // Snippet of the last message for easy display in chat list
        type: String,
        trim: true,
        default: ''
    },
    latestMessageType: { // Type of the last message (e.g., 'text', 'template', 'image')
        type: String,
        trim: true,
        default: ''
    },
    isActive: { // Can be used to mark conversations as archived or open
        type: Boolean,
        default: true
    },
    unreadCount: { // Number of unread messages for the web user
        type: Number,
        default: 0
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

// Ensures a unique conversation between a project's phone number and a contact
ConversationSchema.index({ projectId: 1, contactId: 1, metaPhoneNumberID: 1 }, { unique: true });

// Update `updatedAt` on save
ConversationSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Conversation', ConversationSchema);
