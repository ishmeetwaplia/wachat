// server/models/ConversationSession.js
const mongoose = require('mongoose');

const ConversationSessionSchema = new mongoose.Schema({
    // The WhatsApp ID of the user (e.g., "91XXXXXXXXXX")
    whatsappContactId: {
        type: String,
        required: true,
        index: true, // Index for quick lookup by contact
    },
    // The Meta WhatsApp Phone Number ID that received/sent the message
    whatsappPhoneNumberId: {
        type: String,
        required: true,
    },
    // The ID of the Project this conversation belongs to
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
    },
    // The ID of the Flow that is currently active for this session
    currentFlowId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Flow',
        required: false, // Can be null if no flow is active
    },
    // The ID of the current node the conversation is at within the active flow
    currentNodeId: {
        type: String, // ReactFlow node ID (string)
        required: false, // Can be null if no flow is active or at start
    },
    // Stores data collected during the conversation (e.g., from CollectInputNode)
    collectedData: {
        type: mongoose.Schema.Types.Mixed, // Flexible object to store key-value pairs
        default: {},
    },
    awaitingFieldId: {
        type: String, // The ID of the field (e.g., 'name', 'email')
        required: false,
    },
    // Status of the session (e.g., active, ended, awaiting_input, live_agent)
    status: {
        type: String,
        enum: ['active', 'ended', 'awaiting_input', 'live_agent_handoff'],
        default: 'active',
    },
    // Timestamp for when the session was last active (useful for session timeouts)
    lastActivityAt: {
        type: Date,
        default: Date.now,
    },
    // Tenant and User IDs for multi-tenancy and ownership
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
    },
    userId: { // The user who owns the project/flow associated with this session
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, { timestamps: true }); // Adds createdAt and updatedAt

// Add a compound unique index to ensure only one active session per contact per phone number
// The partialFilterExpression ensures uniqueness only for 'active' or 'awaiting_input' sessions.
ConversationSessionSchema.index(
    { whatsappContactId: 1, whatsappPhoneNumberId: 1, projectId: 1, status: 1 },
    { unique: true, partialFilterExpression: { status: { $in: ['active', 'awaiting_input'] } } }
);


module.exports = mongoose.model('ConversationSession', ConversationSessionSchema);
