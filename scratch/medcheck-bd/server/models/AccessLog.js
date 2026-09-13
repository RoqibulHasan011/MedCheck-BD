const mongoose = require('mongoose');

const accessLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  userEmail: {
    type: String,
    default: 'guest@medcheckbd.com',
  },
  userRole: {
    type: String,
    default: 'guest',
  },
  action: {
    type: String,
    required: true,
    index: true,
  },
  resourceType: {
    type: String,
    required: true,
    index: true,
  },
  resourceId: {
    type: String,
    default: '',
  },
  details: {
    type: String,
    default: '',
  },
  ipAddress: {
    type: String,
    default: '127.0.0.1',
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

module.exports = mongoose.model('AccessLog', accessLogSchema);
