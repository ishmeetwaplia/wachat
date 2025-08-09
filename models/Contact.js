const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    userId: { // The user who owns this contact (project owner's ID)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    name: {
        type: String,
        trim: true,
        default: ''
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        sparse: true // Allows nulls, but unique if a value exists
    },
    countryCode: {
        type: String,
        trim: true,
        default: ''
    },
    mobileNumber: {
        type: String,
        trim: true,
        required: true
    },
    // NEW fields for WhatsApp integration
    whatsappId: { // Meta's WhatsApp ID (wa_id) for the contact
        type: String,
        trim: true,
        sparse: true, // Can be null if contact isn't a WhatsApp user
        index: true,  default: undefined // avoids setting it as null

    },
    profileName: { // WhatsApp display name for the contact
        type: String,
        trim: true,
        default: ''
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    groupIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group'
    }],
    tags: [String],
    customFields: mongoose.Schema.Types.Mixed, // Flexible field for any extra data
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Ensure unique mobile number + country code per project for a user
ContactSchema.index({ projectId: 1, userId: 1, countryCode: 1, mobileNumber: 1 }, { unique: true });
// Optional: Ensure unique whatsappId per project for a user
// ContactSchema.index({ projectId: 1, userId: 1, whatsappId: 1 }, { unique: true, sparse: true });

ContactSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Contact', ContactSchema);
