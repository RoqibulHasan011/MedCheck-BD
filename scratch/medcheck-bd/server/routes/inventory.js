const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const Pharmacy = require('../models/Pharmacy');
const Medicine = require('../models/Medicine');
const Batch = require('../models/Batch');
const { protect, optionalAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roles');
const { logAccess } = require('../middleware/logger');

// Helper to get pharmacy for current user
const getPharmacyForUser = async (userId) => {
  return await Pharmacy.findOne({ userId });
};

// @route   GET /api/inventory/compare
// @desc    Price check & comparison across all verified pharmacies for a given medicine
// @access  Public
router.get('/compare', optionalAuth, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a medicine name to compare prices' });
    }

    // 1. Direct search
    let medicine = await Medicine.findOne({
      $or: [
        { name: { $regex: query.trim(), $options: 'i' } },
        { genericName: { $regex: query.trim(), $options: 'i' } },
      ],
    });

    // 2. Tokenized search (e.g. "napa 500mg" or "napa500")
    if (!medicine) {
      const spaced = query
        .replace(/([a-zA-Z]+)(\d+)/g, '$1 $2')
        .replace(/(\d+)([a-zA-Z]+)/g, '$1 $2')
        .replace(/[^\w\s]/gi, ' ');

      const tokens = spaced
        .split(/\s+/)
        .map((t) => t.replace(/(mg|ml|gm|mcg|iu)$/i, ''))
        .filter((t) => t.length > 0);

      if (tokens.length > 0) {
        const tokenRegexes = tokens.map((t) => new RegExp(t, 'i'));
        medicine = await Medicine.findOne({
          $and: tokenRegexes.map((r) => ({
            $or: [{ name: r }, { genericName: r }, { strength: r }, { manufacturer: r }],
          })),
        });

        if (!medicine && tokens[0].length >= 3) {
          medicine = await Medicine.findOne({
            $or: [{ name: new RegExp(tokens[0], 'i') }, { genericName: new RegExp(tokens[0], 'i') }],
          });
        }
      }
    }

    if (!medicine) {
      const suggestions = await Medicine.find().limit(4).select('name genericName referencePrice');
      return res.json({
        success: true,
        matchFound: false,
        message: `No medicine found matching "${query}" in the reference database`,
        suggestions,
        data: [],
      });
    }

    // Find all inventory items for this medicine from approved pharmacies
    const inventories = await Inventory.find({ medicineId: medicine._id })
      .populate('pharmacyId')
      .populate('batchId')
      .sort({ sellingPrice: 1 });

    const activePharmaciesStock = inventories
      .filter((inv) => inv.pharmacyId && inv.pharmacyId.status === 'Approved')
      .map((inv) => {
        const diff = inv.sellingPrice - medicine.referencePrice;
        return {
          inventoryId: inv._id,
          pharmacy: {
            id: inv.pharmacyId._id,
            name: inv.pharmacyId.name,
            area: inv.pharmacyId.area,
            address: inv.pharmacyId.address,
            phone: inv.pharmacyId.phone,
            verified: inv.pharmacyId.verified,
          },
          batchNumber: inv.batchId ? inv.batchId.batchNumber : 'Standard',
          price: inv.sellingPrice,
          referencePrice: medicine.referencePrice,
          priceDifference: Number(diff.toFixed(2)),
          priceDifferencePercentage: Number(((diff / medicine.referencePrice) * 100).toFixed(1)),
          quantity: inv.quantity,
          status: inv.quantity <= 0 ? 'Out of Stock' : (inv.quantity < 10 ? 'Low Stock' : 'Available'),
          updatedAt: inv.updatedAt,
        };
      });

    // Find lowest price
    let lowestPrice = null;
    if (activePharmaciesStock.length > 0) {
      lowestPrice = Math.min(...activePharmaciesStock.map((item) => item.price));
    }

    res.json({
      success: true,
      matchFound: true,
      medicine: {
        id: medicine._id,
        name: medicine.name,
        genericName: medicine.genericName,
        manufacturer: medicine.manufacturer,
        dosageForm: medicine.dosageForm,
        strength: medicine.strength,
        referencePrice: medicine.referencePrice,
      },
      lowestPrice,
      count: activePharmaciesStock.length,
      data: activePharmaciesStock,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/inventory
// @desc    Get current pharmacy inventory
// @access  Private/Pharmacy
router.get('/', protect, authorizeRoles('pharmacy', 'admin'), async (req, res) => {
  try {
    let pharmacy;
    if (req.user.role === 'admin' && req.query.pharmacyId) {
      pharmacy = await Pharmacy.findById(req.query.pharmacyId);
    } else {
      pharmacy = await getPharmacyForUser(req.user._id);
    }

    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy profile not found for this user' });
    }

    const inventory = await Inventory.find({ pharmacyId: pharmacy._id })
      .populate('medicineId')
      .populate('batchId')
      .sort({ updatedAt: -1 });

    const now = new Date();
    const formatted = inventory.map((item) => {
      const med = item.medicineId;
      const batch = item.batchId;

      let batchStatus = 'VALID';
      let daysToExpiry = 999;
      if (batch) {
        daysToExpiry = Math.ceil((new Date(batch.expiryDate) - now) / (1000 * 60 * 60 * 24));
        if (daysToExpiry <= 0) batchStatus = 'EXPIRED';
        else if (daysToExpiry <= 60) batchStatus = 'EXPIRING SOON';
      }

      let stockStatus = 'IN STOCK';
      if (item.quantity <= 0) stockStatus = 'OUT OF STOCK';
      else if (item.quantity < 10) stockStatus = 'LOW STOCK';

      return {
        _id: item._id,
        pharmacyId: item.pharmacyId,
        medicine: med,
        batch: batch,
        batchStatus,
        daysToExpiry,
        quantity: item.quantity,
        purchasePrice: item.purchasePrice,
        sellingPrice: item.sellingPrice,
        stockStatus,
        updatedAt: item.updatedAt,
      };
    });

    res.json({
      success: true,
      pharmacy,
      count: formatted.length,
      data: formatted,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/inventory
// @desc    Add medicine to inventory (creates batch if necessary)
// @access  Private/Pharmacy
router.post('/', protect, authorizeRoles('pharmacy'), async (req, res) => {
  try {
    const pharmacy = await getPharmacyForUser(req.user._id);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy profile not found' });
    }

    const {
      medicineId,
      batchNumber,
      manufacturingDate,
      expiryDate,
      quantity,
      purchasePrice,
      sellingPrice,
    } = req.body;

    if (!medicineId || !batchNumber || !quantity || !sellingPrice) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const medicine = await Medicine.findById(medicineId);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Selected medicine does not exist' });
    }

    // Find or create batch
    let batch = await Batch.findOne({
      medicineId: medicine._id,
      batchNumber: batchNumber.trim().toUpperCase(),
    });

    if (!batch) {
      batch = await Batch.create({
        medicineId: medicine._id,
        batchNumber: batchNumber.trim().toUpperCase(),
        manufacturingDate: manufacturingDate || new Date(Date.now() - 1000 * 60 * 60 * 24 * 90),
        expiryDate: expiryDate || new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 2),
      });
    }

    // Check if inventory record already exists for this pharmacy and batch
    let existingItem = await Inventory.findOne({
      pharmacyId: pharmacy._id,
      medicineId: medicine._id,
      batchId: batch._id,
    });

    let inventoryItem;
    if (existingItem) {
      existingItem.quantity += Number(quantity);
      existingItem.purchasePrice = Number(purchasePrice) || existingItem.purchasePrice;
      existingItem.sellingPrice = Number(sellingPrice);
      inventoryItem = await existingItem.save();
    } else {
      inventoryItem = await Inventory.create({
        pharmacyId: pharmacy._id,
        medicineId: medicine._id,
        batchId: batch._id,
        quantity: Number(quantity),
        purchasePrice: Number(purchasePrice) || 0,
        sellingPrice: Number(sellingPrice),
      });
    }

    await logAccess({
      req,
      action: 'UPDATE_INVENTORY',
      resourceType: 'Inventory',
      resourceId: inventoryItem._id,
      details: `Added ${quantity} units of ${medicine.name} (Batch: ${batch.batchNumber}) to ${pharmacy.name}`,
    });

    res.status(201).json({
      success: true,
      message: 'Medicine added to inventory successfully',
      data: inventoryItem,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/inventory/:id
// @desc    Update stock quantity or pricing
// @access  Private/Pharmacy
router.put('/:id', protect, authorizeRoles('pharmacy', 'admin'), async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    const { quantity, purchasePrice, sellingPrice } = req.body;
    if (quantity !== undefined) item.quantity = Number(quantity);
    if (purchasePrice !== undefined) item.purchasePrice = Number(purchasePrice);
    if (sellingPrice !== undefined) item.sellingPrice = Number(sellingPrice);

    await item.save();

    await logAccess({
      req,
      action: 'UPDATE_INVENTORY',
      resourceType: 'Inventory',
      resourceId: item._id,
      details: `Updated inventory item ${item._id} (Qty: ${item.quantity}, Price: ${item.sellingPrice})`,
    });

    res.json({
      success: true,
      message: 'Inventory updated successfully',
      data: item,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   DELETE /api/inventory/:id
// @desc    Delete inventory item
// @access  Private/Pharmacy
router.delete('/:id', protect, authorizeRoles('pharmacy', 'admin'), async (req, res) => {
  try {
    const item = await Inventory.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    await logAccess({
      req,
      action: 'DELETE_INVENTORY',
      resourceType: 'Inventory',
      resourceId: item._id,
      details: `Deleted inventory item ${item._id}`,
    });

    res.json({
      success: true,
      message: 'Medicine removed from inventory',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/inventory/alerts
// @desc    Get pharmacy alerts (low stock, expiring, expired, suspicious)
// @access  Private/Pharmacy
router.get('/alerts', protect, authorizeRoles('pharmacy'), async (req, res) => {
  try {
    const pharmacy = await getPharmacyForUser(req.user._id);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy profile not found' });
    }

    const inventory = await Inventory.find({ pharmacyId: pharmacy._id })
      .populate('medicineId')
      .populate('batchId');

    const now = new Date();
    const alerts = [];

    inventory.forEach((item) => {
      const medName = item.medicineId ? item.medicineId.name : 'Unknown Medicine';
      const batchNum = item.batchId ? item.batchId.batchNumber : 'N/A';

      // Low Stock
      if (item.quantity < 10) {
        alerts.push({
          type: 'LOW_STOCK',
          level: item.quantity <= 0 ? 'danger' : 'warning',
          title: item.quantity <= 0 ? 'Out of Stock' : 'Low Stock Alert',
          message: `${medName} (Batch: ${batchNum}) has only ${item.quantity} units remaining.`,
          medicineId: item.medicineId?._id,
          batchId: item.batchId?._id,
          date: item.updatedAt,
        });
      }

      // Expiry checks
      if (item.batchId) {
        const daysToExpiry = Math.ceil((new Date(item.batchId.expiryDate) - now) / (1000 * 60 * 60 * 24));
        if (daysToExpiry <= 0) {
          alerts.push({
            type: 'EXPIRED',
            level: 'danger',
            title: 'Expired Medicine Alert',
            message: `${medName} (Batch: ${batchNum}) expired ${Math.abs(daysToExpiry)} days ago. Quarantine immediately.`,
            medicineId: item.medicineId?._id,
            batchId: item.batchId?._id,
            date: item.batchId.expiryDate,
          });
        } else if (daysToExpiry <= 60) {
          alerts.push({
            type: 'EXPIRING_SOON',
            level: 'warning',
            title: 'Expiring Soon Warning',
            message: `${medName} (Batch: ${batchNum}) expires in ${daysToExpiry} days (${new Date(item.batchId.expiryDate).toLocaleDateString()}).`,
            medicineId: item.medicineId?._id,
            batchId: item.batchId?._id,
            date: item.batchId.expiryDate,
          });
        }

        if (item.batchId.status === 'SUSPICIOUS' || item.batchId.status === 'RECALLED') {
          alerts.push({
            type: 'FLAGGED_BATCH',
            level: 'danger',
            title: 'Suspicious / Recalled Batch Alert',
            message: `Batch ${batchNum} for ${medName} has been flagged as ${item.batchId.status} by central system.`,
            medicineId: item.medicineId?._id,
            batchId: item.batchId?._id,
            date: new Date(),
          });
        }
      }
    });

    res.json({
      success: true,
      count: alerts.length,
      data: alerts,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
