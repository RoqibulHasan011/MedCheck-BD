const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  medicineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medicine',
    required: true,
  },
  medicineName: {
    type: String,
    required: true,
  },
  genericName: String,
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
  },
  batchNumber: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0,
  },
});

const saleSchema = new mongoose.Schema({
  receiptId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  pharmacyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pharmacy',
    required: true,
    index: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  customerName: {
    type: String,
    default: 'Walk-in Customer',
  },
  customerPhone: {
    type: String,
    default: '',
  },
  items: [saleItemSchema],
  subtotal: {
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    default: 0,
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Cash on Delivery', 'bKash', 'Nagad', 'Card'],
    default: 'Cash',
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Sale', saleSchema);
