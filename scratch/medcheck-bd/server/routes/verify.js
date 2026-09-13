const express = require('express');
const router = express.Router();
const Medicine = require('../models/Medicine');
const Batch = require('../models/Batch');
const Pharmacy = require('../models/Pharmacy');
const Inventory = require('../models/Inventory');
const MedicineHistory = require('../models/MedicineHistory');
const { optionalAuth } = require('../middleware/auth');
const { logAccess } = require('../middleware/logger');

// @route   GET /api/verify/:query
// @desc    Verify medicine by brand, generic, barcode, registration number or batch
// @access  Public (Optional auth for history saving)
router.get('/:query', optionalAuth, async (req, res) => {
  try {
    const rawQuery = decodeURIComponent(req.params.query || '').trim();
    const batchParam = req.query.batch ? req.query.batch.trim() : null;

    if (!rawQuery) {
      return res.status(400).json({ success: false, message: 'Please provide a search term or identifier' });
    }

    // 1. Check if the query itself matches a Batch number directly
    let batchMatch = await Batch.findOne({
      batchNumber: { $regex: `^${rawQuery.trim()}$`, $options: 'i' },
    }).populate('medicineId');

    // 2. Search for matching medicine by direct regex
    let medicine = null;
    if (batchMatch && batchMatch.medicineId) {
      medicine = batchMatch.medicineId;
    } else {
      const cleanRegex = rawQuery.replace(/[^\w\s]/gi, '');
      medicine = await Medicine.findOne({
        $or: [
          { name: { $regex: `^${rawQuery.trim()}$`, $options: 'i' } },
          { name: { $regex: cleanRegex, $options: 'i' } },
          { genericName: { $regex: cleanRegex, $options: 'i' } },
          { registrationNumber: { $regex: `^${rawQuery.trim()}$`, $options: 'i' } },
          { barcode: { $regex: `^${rawQuery.trim()}$`, $options: 'i' } },
          { manufacturer: { $regex: cleanRegex, $options: 'i' } },
        ],
      });

      // If direct match failed, try smart tokenized search (e.g. "napa 500mg" or "napa500")
      if (!medicine) {
        const spaced = rawQuery
          .replace(/([a-zA-Z]+)(\d+)/g, '$1 $2')
          .replace(/(\d+)([a-zA-Z]+)/g, '$1 $2')
          .replace(/[^\w\s]/gi, ' ');

        const tokens = spaced
          .split(/\s+/)
          .map((t) => t.replace(/(mg|ml|gm|mcg|iu)$/i, ''))
          .filter((t) => t.length > 0);

        if (tokens.length > 0) {
          const tokenRegexes = tokens.map((t) => new RegExp(t, 'i'));

          // Try matching all tokens in name, generic, strength or manufacturer
          medicine = await Medicine.findOne({
            $and: tokenRegexes.map((r) => ({
              $or: [{ name: r }, { genericName: r }, { strength: r }, { manufacturer: r }],
            })),
          });

          // If still not matched, try matching the first significant brand token
          if (!medicine && tokens[0].length >= 3) {
            medicine = await Medicine.findOne({
              $or: [{ name: new RegExp(tokens[0], 'i') }, { genericName: new RegExp(tokens[0], 'i') }],
            });
          }
        }
      }
    }

    // If still no direct match, try finding batch if user provided batch as query param
    if (medicine && batchParam && !batchMatch) {
      batchMatch = await Batch.findOne({
        medicineId: medicine._id,
        batchNumber: { $regex: `^${batchParam.trim()}$`, $options: 'i' },
      });
    }

    // If medicine was found, get its primary or most recent batch if none specified
    let selectedBatch = batchMatch;
    if (medicine && !selectedBatch) {
      selectedBatch = await Batch.findOne({ medicineId: medicine._id }).sort({ expiryDate: -1 });
    }

    // If absolutely nothing matched:
    if (!medicine && !batchMatch) {
      // Find top registered suggestions to show the user
      const suggestions = await Medicine.find()
        .limit(4)
        .select('name genericName strength manufacturer referencePrice');

      await logAccess({
        req,
        action: 'VERIFY_MEDICINE',
        resourceType: 'Medicine',
        details: `Verification query with no direct match: "${rawQuery}"`,
      });

      return res.json({
        success: true,
        matchFound: false,
        verificationStatus: 'NOT FOUND',
        badgeColor: 'danger',
        queriedTerm: rawQuery,
        message: `No approved reference or registered batch found directly matching "${rawQuery}".`,
        suggestions,
        disclaimer: 'Absence from this database does not guarantee an unregistered medicine, but warrants careful consultation with a licensed pharmacist or physician.',
      });
    }

    // Determine verification outcome
    let verificationStatus = 'DATABASE MATCH';
    let badgeColor = 'success';
    let statusSummary = 'Database Match: Medicine details match official Bangladesh reference records.';
    let alertMessages = [];

    // Check Medicine Alerts
    if (medicine.alerts && medicine.alerts.length > 0) {
      verificationStatus = 'NEEDS REVIEW';
      badgeColor = 'warning';
      alertMessages.push(...medicine.alerts.map((a) => a.message));
    }

    // Check Registration Status
    if (medicine.registrationStatus === 'NEEDS REVIEW') {
      verificationStatus = 'NEEDS REVIEW';
      badgeColor = 'warning';
      statusSummary = 'Needs Review: Regulatory reference records show pending or flagged review status.';
    } else if (medicine.registrationStatus === 'SUSPENDED' || medicine.registrationStatus === 'NOT FOUND') {
      verificationStatus = 'ALERT DETECTED';
      badgeColor = 'danger';
      statusSummary = `Alert Detected: Medicine status listed as ${medicine.registrationStatus}.`;
    }

    // Check Batch Details if available
    let batchDetails = null;
    if (selectedBatch) {
      const computedBatchStatus = selectedBatch.checkStatus();
      const now = new Date();
      const daysToExpiry = Math.ceil((new Date(selectedBatch.expiryDate) - now) / (1000 * 60 * 60 * 24));

      batchDetails = {
        id: selectedBatch._id,
        batchNumber: selectedBatch.batchNumber,
        manufacturingDate: selectedBatch.manufacturingDate,
        expiryDate: selectedBatch.expiryDate,
        status: computedBatchStatus,
        daysToExpiry,
        reportedCount: selectedBatch.reportedCounterfeitCount || 0,
        notes: selectedBatch.notes || '',
      };

      if (computedBatchStatus === 'EXPIRED') {
        verificationStatus = 'ALERT DETECTED';
        badgeColor = 'danger';
        alertMessages.push(`Batch ${selectedBatch.batchNumber} has expired on ${new Date(selectedBatch.expiryDate).toLocaleDateString()}.`);
      } else if (computedBatchStatus === 'RECALLED' || computedBatchStatus === 'SUSPICIOUS') {
        verificationStatus = 'ALERT DETECTED';
        badgeColor = 'danger';
        alertMessages.push(`Batch ${selectedBatch.batchNumber} is flagged as ${computedBatchStatus}.`);
      } else if (computedBatchStatus === 'EXPIRING_SOON') {
        if (badgeColor !== 'danger') {
          verificationStatus = 'NEEDS REVIEW';
          badgeColor = 'warning';
        }
        alertMessages.push(`Batch ${selectedBatch.batchNumber} expires soon (${daysToExpiry} days remaining).`);
      }
    }

    // Find nearby verified pharmacies with this medicine in stock
    const inventories = await Inventory.find({
      medicineId: medicine._id,
      quantity: { $gt: 0 },
    }).populate('pharmacyId');

    const availablePharmacies = inventories
      .filter((inv) => inv.pharmacyId && inv.pharmacyId.status === 'Approved')
      .map((inv) => ({
        pharmacyId: inv.pharmacyId._id,
        name: inv.pharmacyId.name,
        area: inv.pharmacyId.area,
        address: inv.pharmacyId.address,
        phone: inv.pharmacyId.phone,
        verified: inv.pharmacyId.verified,
        openingHours: inv.pharmacyId.openingHours,
        price: inv.sellingPrice,
        quantity: inv.quantity,
        stockStatus: inv.quantity < 10 ? 'LOW STOCK' : 'IN STOCK',
      }));

    // Record access log
    await logAccess({
      req,
      action: 'VERIFY_MEDICINE',
      resourceType: 'Medicine',
      resourceId: medicine._id,
      details: `Verified medicine: ${medicine.name}, Status: ${verificationStatus}, Batch: ${selectedBatch ? selectedBatch.batchNumber : 'N/A'}`,
    });

    // Save to user history if logged in as customer
    if (req.user && req.user.role === 'customer') {
      try {
        await MedicineHistory.create({
          customerId: req.user._id,
          medicineId: medicine._id,
          medicineName: medicine.name,
          genericName: medicine.genericName,
          manufacturer: medicine.manufacturer,
          batchNumber: selectedBatch ? selectedBatch.batchNumber : 'N/A',
          verificationStatus,
          type: 'VERIFICATION',
        });
      } catch (histErr) {
        console.error('[History Save Error]', histErr.message);
      }
    }

    res.json({
      success: true,
      matchFound: true,
      verificationStatus,
      badgeColor,
      statusSummary,
      alerts: alertMessages,
      disclaimer: 'MedCheck BD provides database and reference information. Medicine authenticity represents verification status and database match, not guaranteed physical chemical testing. Always verify with licensed healthcare professionals.',
      data: {
        medicine: {
          id: medicine._id,
          name: medicine.name,
          genericName: medicine.genericName,
          manufacturer: medicine.manufacturer,
          strength: medicine.strength,
          dosageForm: medicine.dosageForm,
          category: medicine.category,
          registrationStatus: medicine.registrationStatus,
          registrationNumber: medicine.registrationNumber,
          referencePrice: medicine.referencePrice,
          barcode: medicine.barcode || 'N/A',
          description: medicine.description,
          alerts: medicine.alerts,
        },
        batch: batchDetails,
        availablePharmacies,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
