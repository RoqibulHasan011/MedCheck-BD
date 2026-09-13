const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Pharmacy = require('../models/Pharmacy');
const Medicine = require('../models/Medicine');
const Batch = require('../models/Batch');
const Report = require('../models/Report');
const AccessLog = require('../models/AccessLog');
const Inventory = require('../models/Inventory');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roles');
const { logAccess } = require('../middleware/logger');

// Middleware to ensure all routes in this file are admin-only
router.use(protect, authorizeRoles('admin'));

// @route   GET /api/admin/stats
// @desc    Get dashboard metrics and Chart.js aggregation data
// @access  Private/Admin
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      totalPharmacies,
      verifiedPharmacies,
      pendingPharmaciesCount,
      totalMedicines,
      totalReports,
      pendingReports,
      accessLogsCount,
    ] = await Promise.all([
      User.countDocuments(),
      Pharmacy.countDocuments(),
      Pharmacy.countDocuments({ verified: true, status: 'Approved' }),
      Pharmacy.countDocuments({ status: 'Pending' }),
      Medicine.countDocuments(),
      Report.countDocuments(),
      Report.countDocuments({ status: 'Pending Review' }),
      AccessLog.countDocuments(),
    ]);

    // Active medicine alerts count
    const medicinesWithAlerts = await Medicine.find({ 'alerts.0': { $exists: true } });
    const batchAlerts = await Batch.countDocuments({
      status: { $in: ['EXPIRED', 'RECALLED', 'SUSPICIOUS'] },
    });
    const totalActiveAlerts = medicinesWithAlerts.length + batchAlerts;

    // Aggregations for Chart.js
    // 1. Reports by issue category
    const reportsByCategory = await Report.aggregate([
      { $group: { _id: '$issueType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // 2. Pharmacies by area
    const pharmaciesByArea = await Pharmacy.aggregate([
      { $group: { _id: '$area', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);

    // 3. Medicines by category
    const medicinesByCategory = await Medicine.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]);

    // 4. Access logs by action
    const accessByAction = await AccessLog.aggregate([
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]);

    res.json({
      success: true,
      data: {
        cards: {
          totalUsers,
          totalPharmacies,
          verifiedPharmacies,
          pendingPharmacies: pendingPharmaciesCount,
          totalMedicines,
          totalReports,
          pendingReports,
          activeAlerts: totalActiveAlerts,
          accessLogsCount,
        },
        charts: {
          reportsByCategory,
          pharmaciesByArea,
          medicinesByCategory,
          accessByAction,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/admin/pending-pharmacies
// @desc    List pharmacies waiting for verification
// @access  Private/Admin
router.get('/pending-pharmacies', async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find({ status: 'Pending' }).populate('userId', 'name email phone').sort({ createdAt: -1 });
    res.json({ success: true, count: pharmacies.length, data: pharmacies });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/admin/all-pharmacies
// @desc    List all pharmacies with their status
// @access  Private/Admin
router.get('/all-pharmacies', async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find().populate('userId', 'name email phone').sort({ createdAt: -1 });
    res.json({ success: true, count: pharmacies.length, data: pharmacies });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/admin/pharmacies/:id/approve
// @desc    Approve a pending pharmacy & mark verified
// @access  Private/Admin
router.put('/pharmacies/:id/approve', async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }

    pharmacy.status = 'Approved';
    pharmacy.verified = true;
    await pharmacy.save();

    await logAccess({
      req,
      action: 'APPROVE_PHARMACY',
      resourceType: 'Pharmacy',
      resourceId: pharmacy._id,
      details: `Admin approved and verified pharmacy: ${pharmacy.name} (License: ${pharmacy.licenseNumber})`,
    });

    res.json({
      success: true,
      message: `Pharmacy "${pharmacy.name}" has been approved and granted Verified Status.`,
      data: pharmacy,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/admin/pharmacies/:id/reject
// @desc    Reject a pharmacy application
// @access  Private/Admin
router.put('/pharmacies/:id/reject', async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }

    pharmacy.status = 'Rejected';
    pharmacy.verified = false;
    await pharmacy.save();

    await logAccess({
      req,
      action: 'REJECT_PHARMACY',
      resourceType: 'Pharmacy',
      resourceId: pharmacy._id,
      details: `Admin rejected pharmacy registration: ${pharmacy.name}`,
    });

    res.json({
      success: true,
      message: `Pharmacy "${pharmacy.name}" has been rejected.`,
      data: pharmacy,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/admin/access-logs
// @desc    Stream access and security audit logs
// @access  Private/Admin
router.get('/access-logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logs = await AccessLog.find().sort({ timestamp: -1 }).limit(limit);

    res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/admin/users
// @desc    List all system users
// @access  Private/Admin
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
