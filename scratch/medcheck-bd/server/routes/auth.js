const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Pharmacy = require('../models/Pharmacy');
const { protect } = require('../middleware/auth');
const { logAccess } = require('../middleware/logger');

// Generate JWT token helper
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'medcheck_bd_super_secure_jwt_secret_key_2026_bangladesh', {
    expiresIn: '30d',
  });
};

// @route   POST /api/auth/register
// @desc    Register a Customer or Admin
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    const assignedRole = role === 'admin' ? 'admin' : (role === 'pharmacy' ? 'pharmacy' : 'customer');

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      password,
      role: assignedRole,
    });

    const token = generateToken(user._id);

    await logAccess({
      req,
      action: 'REGISTER',
      resourceType: 'Auth',
      resourceId: user._id,
      details: `Registered user: ${user.name} (${user.role})`,
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/auth/pharmacy-register
// @desc    Register a Pharmacy with License (Pending approval)
// @access  Public
router.post('/pharmacy-register', async (req, res) => {
  try {
    const {
      pharmacyName,
      ownerName,
      email,
      phone,
      password,
      address,
      area,
      division,
      licenseNumber,
      openingHours,
    } = req.body;

    if (!pharmacyName || !ownerName || !email || !phone || !password || !address || !area || !licenseNumber) {
      return res.status(400).json({ success: false, message: 'Please provide all required pharmacy details' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    const existingPharmacy = await Pharmacy.findOne({ licenseNumber: licenseNumber.trim().toUpperCase() });
    if (existingPharmacy) {
      return res.status(400).json({ success: false, message: 'A pharmacy with this license number already exists' });
    }

    // Create user with role 'pharmacy'
    const user = await User.create({
      name: ownerName,
      email: email.toLowerCase(),
      phone,
      password,
      role: 'pharmacy',
    });

    // Create pharmacy record with status 'Pending'
    const pharmacy = await Pharmacy.create({
      name: pharmacyName,
      ownerName,
      phone,
      email: email.toLowerCase(),
      address,
      area,
      division: division || 'Dhaka',
      licenseNumber: licenseNumber.trim().toUpperCase(),
      verified: false,
      status: 'Pending',
      openingHours: openingHours || '8:00 AM - 11:00 PM',
      userId: user._id,
    });

    const token = generateToken(user._id);

    await logAccess({
      req,
      action: 'REGISTER_PHARMACY',
      resourceType: 'Pharmacy',
      resourceId: pharmacy._id,
      details: `New pharmacy registered: ${pharmacy.name}, License: ${pharmacy.licenseNumber}`,
    });

    res.status(201).json({
      success: true,
      message: 'Pharmacy registered successfully! Your account is currently Pending Admin Verification.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      pharmacy: {
        id: pharmacy._id,
        name: pharmacy.name,
        status: pharmacy.status,
        verified: pharmacy.verified,
        licenseNumber: pharmacy.licenseNumber,
        area: pharmacy.area,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate User & Return Token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    let pharmacyInfo = null;
    if (user.role === 'pharmacy') {
      pharmacyInfo = await Pharmacy.findOne({ userId: user._id });
    }

    const token = generateToken(user._id);

    await logAccess({
      req,
      action: 'LOGIN',
      resourceType: 'Auth',
      resourceId: user._id,
      details: `User logged in: ${user.email} (${user.role})`,
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      pharmacy: pharmacyInfo,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/auth/me
// @desc    Get Current Logged-in User
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    let pharmacyInfo = null;
    if (req.user.role === 'pharmacy') {
      pharmacyInfo = await Pharmacy.findOne({ userId: req.user._id });
    }

    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        role: req.user.role,
        createdAt: req.user.createdAt,
      },
      pharmacy: pharmacyInfo,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
