const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const Batch = require('../models/Batch');
const { protect, optionalAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roles');
const { logAccess } = require('../middleware/logger');

// Generate unique report ID
const generateReportId = () => {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `RPT-${year}-${randomNum}`;
};

// @route   POST /api/reports
// @desc    Submit a suspicious medicine report
// @access  Public (logged-in or anonymous)
router.post('/', optionalAuth, async (req, res) => {
  try {
    const {
      medicineName,
      genericName,
      manufacturer,
      batchNumber,
      pharmacyName,
      pharmacyLocation,
      issueType,
      description,
      customerName,
      customerPhone,
      imageUrl,
    } = req.body;

    if (!medicineName || !issueType || !description) {
      return res.status(400).json({
        success: false,
        message: 'Please provide medicine name, issue category, and description details',
      });
    }

    const reportId = generateReportId();

    const report = await Report.create({
      reportId,
      customerId: req.user ? req.user._id : null,
      customerName: customerName || (req.user ? req.user.name : 'Anonymous Citizen'),
      customerPhone: customerPhone || (req.user ? req.user.phone : ''),
      medicineName,
      genericName: genericName || '',
      manufacturer: manufacturer || '',
      batchNumber: batchNumber ? batchNumber.trim().toUpperCase() : '',
      pharmacyName: pharmacyName || '',
      pharmacyLocation: pharmacyLocation || '',
      issueType,
      description,
      imageUrl: imageUrl || '',
      status: 'Pending Review',
    });

    // If a batch number was reported, flag or increase reported count
    if (batchNumber) {
      await Batch.updateOne(
        { batchNumber: batchNumber.trim().toUpperCase() },
        { $inc: { reportedCounterfeitCount: 1 } }
      );
    }

    await logAccess({
      req,
      action: 'SUBMIT_REPORT',
      resourceType: 'Report',
      resourceId: report._id,
      details: `Suspicious medicine reported: ${medicineName}, Issue: ${issueType}, ID: ${reportId}`,
    });

    res.status(201).json({
      success: true,
      message: 'Suspicious medicine report registered successfully. Thank you for helping keep healthcare transparent.',
      reportId: report.reportId,
      disclaimer: 'MedCheck BD is an information recording platform. Reports are reviewed by system administrators for database warning updates and do not constitute an official DGDA legal finding.',
      data: report,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/reports
// @desc    Get reports (Admin sees all, customer sees own reports)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'customer') {
      query.customerId = req.user._id;
    }

    const { status, issueType } = req.query;
    if (status && status !== 'All') query.status = status;
    if (issueType && issueType !== 'All') query.issueType = issueType;

    const reports = await Report.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/reports/:id
// @desc    Get single report by ID or ReportId
// @access  Public / Private
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const report = await Report.findOne({
      $or: [{ _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }, { reportId: req.params.id }],
    });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/reports/:id
// @desc    Update report status or admin notes (Admin only)
// @access  Private/Admin
router.put('/:id', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    const { status, adminNotes } = req.body;

    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    if (status) report.status = status;
    if (adminNotes !== undefined) report.adminNotes = adminNotes;
    report.updatedAt = new Date();

    await report.save();

    await logAccess({
      req,
      action: 'UPDATE_REPORT',
      resourceType: 'Report',
      resourceId: report._id,
      details: `Admin updated report ${report.reportId} status to "${report.status}"`,
    });

    res.json({
      success: true,
      message: 'Report status updated',
      data: report,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
