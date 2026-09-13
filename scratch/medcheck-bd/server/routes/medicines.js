const express = require('express');
const router = express.Router();
const Medicine = require('../models/Medicine');
const Batch = require('../models/Batch');
const { protect, optionalAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roles');
const { logAccess } = require('../middleware/logger');

// @route   GET /api/medicines
// @desc    Get all medicines with search & filters
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { search, category, dosageForm, manufacturer, status, limit = 50, page = 1 } = req.query;

    const query = {};

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { genericName: { $regex: term, $options: 'i' } },
        { manufacturer: { $regex: term, $options: 'i' } },
        { registrationNumber: { $regex: term, $options: 'i' } },
        { barcode: { $regex: term, $options: 'i' } },
      ];
    }

    if (category) {
      query.category = category;
    }
    if (dosageForm) {
      query.dosageForm = dosageForm;
    }
    if (manufacturer) {
      query.manufacturer = manufacturer;
    }
    if (status) {
      query.registrationStatus = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Medicine.countDocuments(query);
    const medicines = await Medicine.find(query).sort({ name: 1 }).skip(skip).limit(parseInt(limit));

    // Log search event if a query was provided
    if (search) {
      await logAccess({
        req,
        action: 'SEARCH_MEDICINE',
        resourceType: 'Medicine',
        details: `Searched medicines with query: "${search}"`,
      });
    }

    res.json({
      success: true,
      count: medicines.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: medicines,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/medicines/suggestions
// @desc    Fast search suggestions for autocomplete dropdown
// @access  Public
router.get('/suggestions', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 1) {
      return res.json({ success: true, data: [] });
    }

    const clean = q.replace(/[^\w\s]/gi, ' ').trim();
    const tokens = clean.split(/\s+/).filter(t => t.length > 0);
    const regex = new RegExp(clean.replace(/\s+/g, '.*'), 'i');

    const suggestions = await Medicine.find({
      $or: [
        { name: regex },
        { genericName: regex },
        { manufacturer: regex },
        { barcode: regex },
        { registrationNumber: regex },
      ],
    })
      .select('name genericName strength dosageForm manufacturer referencePrice barcode')
      .limit(8);

    res.json({ success: true, count: suggestions.length, data: suggestions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/medicines/:id
// @desc    Get single medicine details with active batches and alerts
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }

    // Retrieve batches for this medicine
    const batches = await Batch.find({ medicineId: medicine._id }).sort({ expiryDate: -1 });

    // Re-evaluate batch statuses based on current date
    const evaluatedBatches = batches.map((batch) => {
      const bObj = batch.toObject();
      bObj.computedStatus = batch.checkStatus();
      return bObj;
    });

    await logAccess({
      req,
      action: 'VIEW_MEDICINE',
      resourceType: 'Medicine',
      resourceId: medicine._id,
      details: `Viewed medicine details: ${medicine.name} (${medicine.genericName})`,
    });

    res.json({
      success: true,
      data: {
        ...medicine.toObject(),
        batches: evaluatedBatches,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/medicines
// @desc    Create a new medicine (Admin only)
// @access  Private/Admin
router.post('/', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    const medicine = await Medicine.create(req.body);

    await logAccess({
      req,
      action: 'CREATE_MEDICINE',
      resourceType: 'Medicine',
      resourceId: medicine._id,
      details: `Admin created new medicine: ${medicine.name}`,
    });

    res.status(201).json({
      success: true,
      message: 'Medicine added successfully to database',
      data: medicine,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/medicines/:id
// @desc    Update a medicine (Admin only)
// @access  Private/Admin
router.put('/:id', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    const medicine = await Medicine.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }

    await logAccess({
      req,
      action: 'UPDATE_MEDICINE',
      resourceType: 'Medicine',
      resourceId: medicine._id,
      details: `Admin updated medicine: ${medicine.name}`,
    });

    res.json({
      success: true,
      message: 'Medicine updated successfully',
      data: medicine,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   DELETE /api/medicines/:id
// @desc    Delete a medicine (Admin only)
// @access  Private/Admin
router.delete('/:id', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    const medicine = await Medicine.findByIdAndDelete(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }

    // Delete associated batches
    await Batch.deleteMany({ medicineId: medicine._id });

    await logAccess({
      req,
      action: 'DELETE_MEDICINE',
      resourceType: 'Medicine',
      resourceId: medicine._id,
      details: `Admin deleted medicine: ${medicine.name}`,
    });

    res.json({
      success: true,
      message: 'Medicine and associated batches deleted',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/medicines/:id/batches
// @desc    Add a batch to a medicine (Admin only)
// @access  Private/Admin
router.post('/:id/batches', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }

    const { batchNumber, manufacturingDate, expiryDate, status, notes } = req.body;

    const batch = await Batch.create({
      medicineId: medicine._id,
      batchNumber: batchNumber.trim().toUpperCase(),
      manufacturingDate,
      expiryDate,
      status: status || 'VALID',
      notes,
    });

    await logAccess({
      req,
      action: 'CREATE_BATCH',
      resourceType: 'Batch',
      resourceId: batch._id,
      details: `Added batch ${batch.batchNumber} to medicine ${medicine.name}`,
    });

    res.status(201).json({
      success: true,
      message: 'Batch registered successfully',
      data: batch,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/medicines/:id/batches
// @desc    Get batches for a medicine
// @access  Public
router.get('/:id/batches', async (req, res) => {
  try {
    const batches = await Batch.find({ medicineId: req.params.id }).sort({ expiryDate: -1 });
    res.json({ success: true, data: batches });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
