const express = require('express');
const router = express.Router();
const MedicineHistory = require('../models/MedicineHistory');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roles');

// @route   GET /api/history
// @desc    Get current customer's verification and purchase history
// @access  Private/Customer
router.get('/', protect, authorizeRoles('customer', 'admin'), async (req, res) => {
  try {
    const { type } = req.query;
    const query = { customerId: req.user._id };

    if (type && type !== 'ALL') {
      query.type = type;
    }

    const history = await MedicineHistory.find(query)
      .populate('medicineId')
      .populate('pharmacyId', 'name address phone area')
      .sort({ checkedAt: -1 });

    res.json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/history
// @desc    Log a medicine to personal history
// @access  Private/Customer
router.post('/', protect, authorizeRoles('customer', 'admin'), async (req, res) => {
  try {
    const {
      medicineId,
      medicineName,
      genericName,
      manufacturer,
      batchNumber,
      verificationStatus,
      pharmacyId,
      pharmacyName,
      type,
      notes,
    } = req.body;

    const record = await MedicineHistory.create({
      customerId: req.user._id,
      medicineId: medicineId || null,
      medicineName: medicineName || 'Verified Medicine',
      genericName: genericName || '',
      manufacturer: manufacturer || 'Generic / Unknown',
      batchNumber: batchNumber || 'MANUAL-LOG',
      verificationStatus: verificationStatus || 'DATABASE MATCH',
      pharmacyId: pharmacyId || null,
      pharmacyName: pharmacyName || '',
      type: type || 'VERIFICATION',
      notes: notes || '',
    });

    res.status(201).json({
      success: true,
      message: 'Added to medicine history',
      data: record,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   DELETE /api/history/:id
// @desc    Delete a specific history item
// @access  Private/Customer
router.delete('/:id', protect, authorizeRoles('customer', 'admin'), async (req, res) => {
  try {
    const item = await MedicineHistory.findOne({
      _id: req.params.id,
      customerId: req.user._id,
    });

    if (!item) {
      return res.status(404).json({ success: false, message: 'History record not found' });
    }

    await item.deleteOne();

    res.json({
      success: true,
      message: 'Record removed from history',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   DELETE /api/history
// @desc    Clear all history for customer
// @access  Private/Customer
router.delete('/', protect, authorizeRoles('customer'), async (req, res) => {
  try {
    await MedicineHistory.deleteMany({ customerId: req.user._id });

    res.json({
      success: true,
      message: 'Medicine history cleared successfully',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
