const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Medicine brand name is required'],
      trim: true,
      index: true,
    },
    genericName: {
      type: String,
      required: [true, 'Generic name is required'],
      trim: true,
      index: true,
    },
    manufacturer: {
      type: String,
      required: [true, 'Manufacturer is required'],
      trim: true,
      index: true,
    },
    strength: {
      type: String,
      required: true,
      trim: true,
    },
    dosageForm: {
      type: String,
      required: true,
      enum: ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Eye Drops', 'Ointment', 'Inhaler', 'Suppository'],
      default: 'Tablet',
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    registrationStatus: {
      type: String,
      enum: ['REGISTERED', 'NEEDS REVIEW', 'NOT FOUND', 'SUSPENDED'],
      default: 'REGISTERED',
    },
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    referencePrice: {
      type: Number,
      required: [true, 'Reference/Official price is required'],
      min: 0,
    },
    alerts: [
      {
        alertType: {
          type: String,
          enum: ['RECALL', 'PRICE_MISMATCH', 'SUSPICIOUS_BATCH', 'QUALITY_WARNING', 'INFO'],
          default: 'INFO',
        },
        message: String,
        date: { type: Date, default: Date.now },
      },
    ],
    description: {
      type: String,
      default: '',
    },
    sideEffects: {
      type: String,
      default: '',
    },
    dosageInstructions: {
      type: String,
      default: '',
    },
    barcode: {
      type: String,
      trim: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound text index for robust full-text search
medicineSchema.index({
  name: 'text',
  genericName: 'text',
  manufacturer: 'text',
  category: 'text',
});

module.exports = mongoose.model('Medicine', medicineSchema);
