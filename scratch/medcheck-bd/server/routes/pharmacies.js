const express = require('express');
const router = express.Router();
const Pharmacy = require('../models/Pharmacy');
const Inventory = require('../models/Inventory');
const Medicine = require('../models/Medicine');
const { protect, optionalAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roles');
const { logAccess } = require('../middleware/logger');

// @route   GET /api/pharmacies/suggestions
// @desc    Live autocomplete suggestions for pharmacy search
// @access  Public
router.get('/suggestions', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 1) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const regex = new RegExp(q.replace(/[^\w\s]/gi, ''), 'i');
    const pharmacies = await Pharmacy.find({
      status: 'Approved',
      $or: [{ name: regex }, { area: regex }, { address: regex }],
    })
      .select('name area division address verified phone')
      .limit(6);

    res.json({
      success: true,
      count: pharmacies.length,
      data: pharmacies,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/pharmacies
// @desc    Get verified and approved pharmacies with location and medicine search
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { area, division, search, medicineName, verifiedOnly } = req.query;

    const query = { status: 'Approved' };

    if (area && area !== 'All Areas') {
      query.area = area;
    }
    if (division && division !== 'All Divisions') {
      query.division = division;
    }
    if (verifiedOnly === 'true') {
      query.verified = true;
    }
    if (search) {
      const sTrim = search.trim();
      const sClean = sTrim.replace(/[^\w\s]/gi, '');
      query.$or = [
        { name: { $regex: sClean, $options: 'i' } },
        { address: { $regex: sClean, $options: 'i' } },
        { area: { $regex: sClean, $options: 'i' } },
      ];
    }

    // If searching by medicine availability
    let pharmacyIdsWithMedicine = null;
    if (medicineName && medicineName.trim()) {
      const cleanMed = medicineName.trim();
      const spaced = cleanMed
        .replace(/([a-zA-Z]+)(\d+)/g, '$1 $2')
        .replace(/(\d+)([a-zA-Z]+)/g, '$1 $2')
        .replace(/[^\w\s]/gi, ' ');
      const tokens = spaced
        .split(/\s+/)
        .map((t) => t.replace(/(mg|ml|gm|mcg|iu)$/i, ''))
        .filter((t) => t.length > 0);

      const medOrConditions = [
        { name: { $regex: cleanMed.replace(/[^\w\s]/gi, ''), $options: 'i' } },
        { genericName: { $regex: cleanMed.replace(/[^\w\s]/gi, ''), $options: 'i' } },
      ];

      if (tokens.length > 0) {
        const tokenRegexes = tokens.map((t) => new RegExp(t, 'i'));
        medOrConditions.push({
          $and: tokenRegexes.map((r) => ({
            $or: [{ name: r }, { genericName: r }, { strength: r }],
          })),
        });
      }

      const matchingMeds = await Medicine.find({ $or: medOrConditions }).select('_id');
      const medIds = matchingMeds.map((m) => m._id);

      const matchingInv = await Inventory.find({
        medicineId: { $in: medIds },
        quantity: { $gt: 0 },
      }).distinct('pharmacyId');

      pharmacyIdsWithMedicine = matchingInv;
      query._id = { $in: pharmacyIdsWithMedicine };
    }

    let pharmacies = await Pharmacy.find(query).sort({ verified: -1, name: 1 });
    let fallbackToAllAreas = false;
    let searchedArea = null;

    // Smart Fallback: If area/division filter produced 0 results, check across all areas!
    if (pharmacies.length === 0 && ((area && area !== 'All Areas') || (division && division !== 'All Divisions'))) {
      searchedArea = area && area !== 'All Areas' ? area : division;
      const relaxedQuery = { ...query };
      delete relaxedQuery.area;
      delete relaxedQuery.division;

      const relaxedPharmacies = await Pharmacy.find(relaxedQuery).sort({ verified: -1, name: 1 });
      if (relaxedPharmacies.length > 0) {
        pharmacies = relaxedPharmacies;
        fallbackToAllAreas = true;
      }
    }

    // Attach sample available medicines snippet to each pharmacy
    const enriched = await Promise.all(
      pharmacies.map(async (pharmacy) => {
        const pObj = pharmacy.toObject();
        const topInventory = await Inventory.find({ pharmacyId: pharmacy._id, quantity: { $gt: 0 } })
          .populate('medicineId', 'name genericName')
          .limit(5);

        pObj.availableSampleMedicines = topInventory
          .filter((inv) => inv.medicineId)
          .map((inv) => inv.medicineId.name);

        return pObj;
      })
    );

    res.json({
      success: true,
      count: enriched.length,
      data: enriched,
      fallbackToAllAreas,
      searchedArea,
      message: fallbackToAllAreas
        ? `No pharmacy matching "${search || medicineName}" was found directly in ${searchedArea}. Showing ${enriched.length} matching branches in other areas.`
        : undefined,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/pharmacies/:id
// @desc    Get single pharmacy details and its active stock
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }

    // Fetch live inventory for this pharmacy
    const inventory = await Inventory.find({ pharmacyId: pharmacy._id })
      .populate('medicineId')
      .populate('batchId')
      .sort({ updatedAt: -1 });

    // Format stock details with calculated statuses
    const now = new Date();
    const stockItems = inventory.map((item) => {
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

      if (batchStatus === 'EXPIRED') stockStatus = 'EXPIRED';

      return {
        id: item._id,
        medicine: med
          ? {
              id: med._id,
              name: med.name,
              genericName: med.genericName,
              dosageForm: med.dosageForm,
              strength: med.strength,
              manufacturer: med.manufacturer,
              referencePrice: med.referencePrice,
            }
          : null,
        batch: batch
          ? {
              id: batch._id,
              batchNumber: batch.batchNumber,
              manufacturingDate: batch.manufacturingDate,
              expiryDate: batch.expiryDate,
              status: batchStatus,
              daysToExpiry,
            }
          : null,
        quantity: item.quantity,
        purchasePrice: item.purchasePrice,
        sellingPrice: item.sellingPrice,
        stockStatus,
        updatedAt: item.updatedAt,
      };
    });

    await logAccess({
      req,
      action: 'VIEW_PHARMACY',
      resourceType: 'Pharmacy',
      resourceId: pharmacy._id,
      details: `Viewed pharmacy details: ${pharmacy.name}`,
    });

    res.json({
      success: true,
      data: {
        pharmacy,
        stock: stockItems,
        totalItems: stockItems.length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/pharmacies/:id
// @desc    Update pharmacy profile (Pharmacy owner or Admin)
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }

    // Check ownership or admin
    if (req.user.role !== 'admin' && String(pharmacy.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this pharmacy' });
    }

    const { name, phone, address, area, openingHours, isOpenNow } = req.body;
    if (name) pharmacy.name = name;
    if (phone) pharmacy.phone = phone;
    if (address) pharmacy.address = address;
    if (area) pharmacy.area = area;
    if (openingHours) pharmacy.openingHours = openingHours;
    if (typeof isOpenNow === 'boolean') pharmacy.isOpenNow = isOpenNow;

    await pharmacy.save();

    await logAccess({
      req,
      action: 'UPDATE_PHARMACY',
      resourceType: 'Pharmacy',
      resourceId: pharmacy._id,
      details: `Updated pharmacy: ${pharmacy.name}`,
    });

    res.json({
      success: true,
      message: 'Pharmacy details updated',
      data: pharmacy,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
