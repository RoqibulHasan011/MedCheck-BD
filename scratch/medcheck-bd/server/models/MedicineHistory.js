const mongoose = require('mongoose');

const medicineHistorySchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
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
  manufacturer: String,
  batchNumber: String,
  verificationStatus: {
    type: String,
    enum: ['DATABASE MATCH', 'NEEDS REVIEW', 'ALERT DETECTED', 'NOT FOUND', 'PURCHASED'],
    default: 'DATABASE MATCH',
  },
  pharmacyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pharmacy',
    default: null,
  },
  pharmacyName: {
    type: String,
    default: '',
  },
  type: {
    type: String,
    enum: ['VERIFICATION', 'PURCHASE'],
    default: 'VERIFICATION',
  },
  notes: {
    type: String,
    default: '',
  },
  checkedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

module.exports = mongoose.model('MedicineHistory', medicineHistorySchema);
