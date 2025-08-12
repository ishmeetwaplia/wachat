const mongoose = require("mongoose")

const productSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,  
  tenantId: mongoose.Schema.Types.ObjectId,
  catalogId: mongoose.Schema.Types.ObjectId,
  meta_product_id: String,
  retailer_id: {
    type: String,
    trim: true
  },
  name: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    trim: true,
  },
  currency: {
    type: String,
    trim: true
  },
  availability: {
    type: String,
    enum: ["in stock", "out of stock", "preorder"],
    default: "in stock",
    trim: true
  },
  condition: {
    type: String,
    enum: ["new", "refurbished", "used"],
    default: "new",
    trim: true
  },
  image_url: {
    type: String,
    trim: true
  }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model("Product", productSchema);
