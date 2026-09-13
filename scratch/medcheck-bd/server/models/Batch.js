const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  medicineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medicine',
    required: true,
  },
  batchNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    index: true,
  },
  manufacturingDate: {
    type: Date,
    required: true,
  },
  expiryDate: {
    type: Date,
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['VALID', 'EXPIRING_SOON', 'EXPIRED', 'RECALLED', 'SUSPICIOUS'],
    default: 'VALID',
  },
  reportedCounterfeitCount: {
    type: Number,
    default: 0,
  },
  notes: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Calculate status based on expiry and flags
batchSchema.methods.checkStatus = function () {
  const now = new Date();
  const daysToExpiry = Math.ceil((new Date(this.expiryDate) - now) / (1000 * 60 * 60 * 24));
  
  if (this.status === 'RECALLED' || this.status === 'SUSPICIOUS') {
    return this.status;
  }
  if (daysToExpiry <= 0) {
    return 'EXPIRED';
  }
  if (daysToExpiry <= 60) {
    return 'EXPIRING_SOON';
  }
  return 'VALID';
};

module.exports = mongoose.model('Batch', batchSchema);
