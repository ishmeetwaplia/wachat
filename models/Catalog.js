const mongoose = require('mongoose');

const catalogSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    tenantId: mongoose.Schema.Types.ObjectId,
    businessProfileId: String,
    metaId: String,
    catalogId: String,
    name: {
        type: String,
        trim: true
    },
    accessToken: String
}, { versionKey: false, timestamps: true });

const catalogModel = mongoose.model('catalog', catalogSchema);

module.exports = catalogModel;