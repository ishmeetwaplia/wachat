const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    isWhatsappVerified: {
        type: Boolean,
        default: false
    },
    assistantName: {
        type: String,
        trim: true,
        default: ''
    },
    businessProfileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BusinessProfile',
        required: true,
        index: true
    },
    metaPhoneNumberID: {
        type: String,
        trim: true,
        default: ''
    },
    whatsappNumber: {
        type: String,
        trim: true,
        default: ''
    },
    activePlan: { 
        type: String,
        trim: true,
        default: ''
    },
    planDuration: {
        type: String,
        default: 0
    },
    about: {
        type: String,
        trim: true,
        maxlength: 139,
        default: ''
    },
    address: {
        type: String,
        trim: true,
        default: ''
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        default: ''
    },
    websites: {
        type: [String],
        default: []
    },
    vertical: {
        type: String,
        trim: true,
        default: ''
    },
    profilePictureUrl: {
        type: String,
        trim: true,
        default: ''
    },
    batch_size: {
        type: Number,
        default: 20,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { versionKey: false });

ProjectSchema.index({ name: 1, userId: 1, businessProfileId: 1 }, { unique: true });

ProjectSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const projectModel = mongoose.models.project || mongoose.model('project', ProjectSchema);

module.exports = projectModel;