const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reportId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  customerName: {
    type: String,
    default: 'Anonymous Citizen',
  },
  customerPhone: {
    type: String,
    default: '',
  },
  medicineName: {
    type: String,
    required: true,
  },
  genericName: {
    type: String,
    default: '',
  },
  manufacturer: {
    type: String,
    default: '',
  },
  batchNumber: {
    type: String,
    default: '',
  },
  pharmacyName: {
    type: String,
    default: '',
  },
  pharmacyLocation: {
    type: String,
    default: '',
  },
  issueType: {
    type: String,
    required: true,
    enum: [
      'Suspected Counterfeit',
      'Unregistered Medicine',
      'Wrong Price',
      'Expired Medicine',
      'Damaged Packaging',
      'Side Effect Incident',
      'Other',
    ],
  },
  description: {
    type: String,
    required: [true, 'Please provide report details'],
  },
  imageUrl: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['Pending Review', 'Under Investigation', 'Resolved', 'Dismissed'],
    default: 'Pending Review',
    index: true,
  },
  adminNotes: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Report', reportSchema);
