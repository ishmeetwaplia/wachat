const mongoose = require('mongoose');

const catalogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    businessProfileId: {
       type: String,
        required: true
    },
    catalogId: {
        type: String,
        required: true
    },
    metaId: {
        type: String,
    },
    name: {
        type: String,
        trim: true,
        default: "Untitled Catalog"
    },
    accessToken: {
        type: String
    }
}, { versionKey: false, timestamps: true });

const catalogModel = mongoose.model('catalog', catalogSchema);

module.exports = catalogModel;
