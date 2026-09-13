const mongoose = require('mongoose');

const pharmacySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Pharmacy name is required'],
    trim: true,
  },
  ownerName: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  address: {
    type: String,
    required: true,
  },
  area: {
    type: String,
    required: true,
    enum: ['Dhanmondi', 'Mirpur', 'Uttara', 'Mohammadpur', 'Gulshan', 'Banani', 'Badda', 'Motijheel', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', 'Barisal'],
    default: 'Dhanmondi',
    index: true,
  },
  division: {
    type: String,
    default: 'Dhaka',
    index: true,
  },
  licenseNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  verified: {
    type: Boolean,
    default: false,
    index: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending',
    index: true,
  },
  openingHours: {
    type: String,
    default: '8:00 AM - 11:00 PM',
  },
  isOpenNow: {
    type: Boolean,
    default: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Pharmacy', pharmacySchema);
