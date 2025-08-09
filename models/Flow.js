
const mongoose = require('mongoose');

const flowSchema = new mongoose.Schema(
  {
    projectId: mongoose.Schema.Types.ObjectId,
    userId: mongoose.Schema.Types.ObjectId,
    tenantId: mongoose.Schema.Types.ObjectId,
    name: {
      type: String,
      trim: true
    },
    entryPoint: {
      type: String,
      required: true
    },
    nodes: [mongoose.Schema.Types.Mixed],
    edges: [mongoose.Schema.Types.Mixed],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

module.exports = mongoose.model('Flow', flowSchema);
