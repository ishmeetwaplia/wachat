const mongoose = require('mongoose');

const BusinessProfileSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    businessAddress: {
        type: String,
        trim: true,
        default: ''
    },
    metaAccessToken: {
        type: String,
        required: true,
        trim: true
    },
    metaAppId: {
        type: String,
        trim: true,
        default: ''
    },
    metaBusinessId: {
        type: String,
        required: true,
        trim: true

    },
    isDefault: {
        type: Boolean,
        default: false
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

// ✅ Enforce unique metaBusinessId **per tenant**
BusinessProfileSchema.index(
    { tenantId: 1, metaBusinessId: 1 },
    { unique: true, name: 'unique_metaBusiness_per_tenant' }
);

// Optional: For user/tenant lookup speed
BusinessProfileSchema.index({ userId: 1, tenantId: 1 });

// Auto-update timestamps
BusinessProfileSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('BusinessProfile', BusinessProfileSchema);
