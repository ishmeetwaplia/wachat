const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    username: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    passwordChangedAt: Date,
    role: {
        type: String,
        enum: ['super_admin', 'tenant_admin', 'user', 'team-member'],
        default: 'user'
    },
    firstName: { 
        type: String,
        trim: true,
        default: ''
    },
    lastName: { 
        type: String,
        trim: true,
        default: ''
    },
    mobileNumber: { 
        type: String,
        trim: true,
        default: ''
    },
    projectId: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: function() { return this.role === 'team-member'; },
        index: true 
    },
    permissions: { 
        type: [String], 
        default: []
    },
    isActive: { 
        type: Boolean,
        default: true
    },
    otp: {
        type: String,
        trim: true
    },
    otpExpiresAt: { type: Date },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    token: String,
    lastLoginAt: {
        type: Date,
        default: null
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

UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

UserSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});


module.exports = mongoose.model('User', UserSchema);
