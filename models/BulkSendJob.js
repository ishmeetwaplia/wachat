// server/models/BulkSendJob.js
const mongoose = require('mongoose');

const BulkSendJobSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true // Index for multi-tenancy filtering
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true // Index for user-specific filtering
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true // Index for project-specific filtering
    },
      groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        default: null,
        index: true
    },
    templateName: {
        type: String,
        required: true,
        trim: true
    },
    fileName: {
        type: String,
        trim: true,
        default: 'N/A' // Name of the uploaded file
    },
    totalContacts: {
        type: Number,
        required: true,
        default: 0
    },
    totalSent: {
        type: Number,
        default: 0
    },
    totalFailed: {
        type: Number,
        default: 0
    },
    errorsSummary: {
        type: mongoose.Schema.Types.Mixed, // Store a summary of errors (e.g., array of {to, error})
        default: []
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'completed_with_errors', 'failed', 'cancelled'],
        default: 'pending',
        index: true // Index for status filtering
    },
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: {
        type: Date
    },
    // Optional: Add a field to store the original template components/variables used
    // This can be useful for auditing or re-running failed segments
    templateDetails: mongoose.Schema.Types.Mixed,
}, {
    timestamps: true // Adds createdAt and updatedAt automatically
});

// Compound index for efficient querying by tenant, user, and project
BulkSendJobSchema.index({ tenantId: 1, userId: 1, projectId: 1, startTime: -1 });

module.exports = mongoose.model('BulkSendJob', BulkSendJobSchema);