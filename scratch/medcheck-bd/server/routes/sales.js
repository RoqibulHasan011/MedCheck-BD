const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const Pharmacy = require('../models/Pharmacy');
const Medicine = require('../models/Medicine');
const Batch = require('../models/Batch');
const User = require('../models/User');
const MedicineHistory = require('../models/MedicineHistory');
const { protect, optionalAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roles');
const { logAccess } = require('../middleware/logger');

// Generate unique receipt ID
const generateReceiptId = () => {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `MC-${year}-${randomNum}`;
};

// @route   POST /api/sales
// @desc    Record a new pharmacy sale, deduct inventory, generate digital receipt
// @access  Private/Pharmacy
router.post('/', protect, authorizeRoles('pharmacy'), async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findOne({ userId: req.user._id });
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy record not found' });
    }

    const { customerName, customerPhone, customerEmail, items, discount = 0, paymentMethod = 'Cash' } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide at least one medicine item for sale' });
    }

    // Attempt to link customer if customer email/phone exists in User DB
    let linkedCustomer = null;
    if (customerEmail) {
      linkedCustomer = await User.findOne({ email: customerEmail.toLowerCase() });
    } else if (customerPhone) {
      linkedCustomer = await User.findOne({ phone: customerPhone.trim() });
    }

    let subtotal = 0;
    const processedItems = [];

    // Validate and deduct stock for each item
    for (const item of items) {
      const { medicineId, batchNumber, quantity } = item;

      const medicine = await Medicine.findById(medicineId);
      if (!medicine) {
        return res.status(404).json({ success: false, message: `Medicine with ID ${medicineId} not found` });
      }

      // Find inventory entry
      const invQuery = { pharmacyId: pharmacy._id, medicineId: medicine._id };
      let batch = null;
      if (batchNumber) {
        batch = await Batch.findOne({ medicineId: medicine._id, batchNumber: batchNumber.trim().toUpperCase() });
        if (batch) {
          invQuery.batchId = batch._id;
        }
      }

      const invItem = await Inventory.findOne(invQuery);
      if (!invItem) {
        return res.status(400).json({
          success: false,
          message: `Item ${medicine.name} (Batch: ${batchNumber || 'Default'}) is not available in your inventory`,
        });
      }

      if (invItem.quantity < Number(quantity)) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${medicine.name}. Requested: ${quantity}, Available: ${invItem.quantity}`,
        });
      }

      // Deduct inventory
      invItem.quantity -= Number(quantity);
      await invItem.save();

      const unitPrice = invItem.sellingPrice || medicine.referencePrice;
      const lineTotal = unitPrice * Number(quantity);
      subtotal += lineTotal;

      processedItems.push({
        medicineId: medicine._id,
        medicineName: medicine.name,
        genericName: medicine.genericName,
        batchId: batch ? batch._id : invItem.batchId,
        batchNumber: batch ? batch.batchNumber : (item.batchNumber || 'BATCH-STD'),
        quantity: Number(quantity),
        unitPrice,
        totalPrice: lineTotal,
      });

      // If linked customer exists, add to MedicineHistory as PURCHASE
      if (linkedCustomer) {
        await MedicineHistory.create({
          customerId: linkedCustomer._id,
          medicineId: medicine._id,
          medicineName: medicine.name,
          genericName: medicine.genericName,
          manufacturer: medicine.manufacturer,
          batchNumber: batch ? batch.batchNumber : 'N/A',
          verificationStatus: 'PURCHASED',
          pharmacyId: pharmacy._id,
          pharmacyName: pharmacy.name,
          type: 'PURCHASE',
          notes: `Purchased at ${pharmacy.name}. Quantity: ${quantity}`,
        });
      }
    }

    const discountAmount = Number(discount) || 0;
    const finalTotal = Math.max(0, subtotal - discountAmount);
    const receiptId = generateReceiptId();

    const sale = await Sale.create({
      receiptId,
      pharmacyId: pharmacy._id,
      customerId: linkedCustomer ? linkedCustomer._id : null,
      customerName: customerName || (linkedCustomer ? linkedCustomer.name : 'Walk-in Customer'),
      customerPhone: customerPhone || (linkedCustomer ? linkedCustomer.phone : ''),
      items: processedItems,
      subtotal,
      discount: discountAmount,
      totalPrice: finalTotal,
      paymentMethod,
      date: new Date(),
    });

    await logAccess({
      req,
      action: 'RECORD_SALE',
      resourceType: 'Sale',
      resourceId: sale._id,
      details: `Sale completed at ${pharmacy.name}. Receipt: ${receiptId}, Total: ৳${finalTotal}`,
    });

    res.status(201).json({
      success: true,
      message: 'Sale recorded and digital receipt created',
      data: sale,
      receiptId: sale.receiptId,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/sales
// @desc    Get sales history (Pharmacy sees own sales, Customer sees their purchases, Admin sees all)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let query = {};

    if (req.user.role === 'pharmacy') {
      const pharmacy = await Pharmacy.findOne({ userId: req.user._id });
      if (!pharmacy) return res.status(404).json({ success: false, message: 'Pharmacy not found' });
      query.pharmacyId = pharmacy._id;
    } else if (req.user.role === 'customer') {
      query.customerId = req.user._id;
    }

    const sales = await Sale.find(query)
      .populate('pharmacyId', 'name address phone area')
      .populate('items.medicineId', 'name genericName dosageForm strength')
      .sort({ date: -1 });

    res.json({
      success: true,
      count: sales.length,
      data: sales,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/sales/customer-order
// @desc    Direct purchase / online order by customer from a verified pharmacy
// @access  Public (optionalAuth to link customer account)
router.post('/customer-order', optionalAuth, async (req, res) => {
  try {
    const {
      pharmacyId,
      medicineId,
      batchNumber,
      quantity = 1,
      customerName,
      customerPhone,
      customerAddress,
      deliveryType = 'Home Delivery',
      paymentMethod = 'Cash on Delivery',
      notes = '',
    } = req.body;

    if (!pharmacyId || !medicineId) {
      return res.status(400).json({ success: false, message: 'Pharmacy ID and Medicine ID are required' });
    }

    const qty = Math.max(1, parseInt(quantity) || 1);

    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }

    const medicine = await Medicine.findById(medicineId);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }

    // Find active stock in this pharmacy
    const invQuery = { pharmacyId: pharmacy._id, medicineId: medicine._id };
    let batch = null;
    if (batchNumber) {
      batch = await Batch.findOne({ medicineId: medicine._id, batchNumber: batchNumber.trim().toUpperCase() });
      if (batch) invQuery.batchId = batch._id;
    }

    let invItem = await Inventory.findOne(invQuery);
    if (!invItem) {
      // Fallback to any active inventory record for this medicine in this pharmacy
      invItem = await Inventory.findOne({ pharmacyId: pharmacy._id, medicineId: medicine._id, quantity: { $gt: 0 } });
    }

    if (!invItem || invItem.quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: `Sorry, ${medicine.name} is currently out of stock at ${pharmacy.name}.`,
      });
    }

    if (invItem.quantity < qty) {
      return res.status(400).json({
        success: false,
        message: `Only ${invItem.quantity} units available in stock at ${pharmacy.name}. You requested ${qty}.`,
      });
    }

    // Deduct stock
    invItem.quantity -= qty;
    await invItem.save();

    const unitPrice = invItem.sellingPrice || medicine.referencePrice;
    const totalPrice = Number((unitPrice * qty).toFixed(2));
    const receiptId = generateReceiptId();

    // Determine linked customer account
    let linkedUser = req.user || null;
    if (!linkedUser && customerPhone) {
      linkedUser = await User.findOne({ phone: customerPhone.trim() });
    }

    const buyerName = customerName || (linkedUser ? linkedUser.name : 'Customer');
    const buyerPhone = customerPhone || (linkedUser ? linkedUser.phone : '');

    const resolvedBatchNumber = batch ? batch.batchNumber : (invItem.batchId ? 'BATCH-STD' : 'BATCH-ONLINE');

    const sale = await Sale.create({
      receiptId,
      pharmacyId: pharmacy._id,
      customerId: linkedUser ? linkedUser._id : null,
      customerName: buyerName,
      customerPhone: buyerPhone,
      items: [
        {
          medicineId: medicine._id,
          medicineName: medicine.name,
          genericName: medicine.genericName,
          batchId: invItem.batchId || (batch ? batch._id : null),
          batchNumber: resolvedBatchNumber,
          quantity: qty,
          unitPrice,
          totalPrice,
        },
      ],
      subtotal: totalPrice,
      discount: 0,
      totalPrice,
      paymentMethod,
    });

    // Create entry in MedicineHistory as PURCHASE
    if (linkedUser) {
      await MedicineHistory.create({
        customerId: linkedUser._id,
        medicineId: medicine._id,
        medicineName: medicine.name,
        genericName: medicine.genericName,
        manufacturer: medicine.manufacturer,
        batchNumber: resolvedBatchNumber,
        verificationStatus: 'PURCHASED',
        pharmacyId: pharmacy._id,
        pharmacyName: pharmacy.name,
        type: 'PURCHASE',
        notes: `Order ${receiptId} (${deliveryType}). Qty: ${qty} units. Payment: ${paymentMethod}. Address: ${customerAddress || 'In-store'}`,
      });
    }

    await logAccess({
      req,
      action: 'CUSTOMER_PURCHASE',
      resourceType: 'Sale',
      resourceId: sale._id,
      details: `Customer order placed: ${medicine.name} x${qty} from ${pharmacy.name}, Receipt: ${receiptId}`,
    });

    res.status(201).json({
      success: true,
      message: `Order placed successfully! Receipt ${receiptId} generated.`,
      receiptId,
      sale,
      totalPrice,
      unitPrice,
      quantity: qty,
      pharmacyName: pharmacy.name,
      medicineName: medicine.name,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/sales/receipt/:receiptId
// @desc    Get details for digital receipt rendering
// @access  Public (receipts are verifiable with ID)
router.get('/receipt/:receiptId', optionalAuth, async (req, res) => {
  try {
    const sale = await Sale.findOne({ receiptId: req.params.receiptId.trim() })
      .populate('pharmacyId')
      .populate('items.medicineId');

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    await logAccess({
      req,
      action: 'VIEW_RECEIPT',
      resourceType: 'Sale',
      resourceId: sale._id,
      details: `Viewed digital receipt: ${sale.receiptId}`,
    });

    res.json({
      success: true,
      data: sale,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
