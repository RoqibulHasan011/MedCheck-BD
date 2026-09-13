const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectDB } = require('./config/db');
const Medicine = require('./models/Medicine');
const seedDatabase = require('./seed/seedData');

// Load environment variables
dotenv.config();

const app = express();

// Standard middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../client')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/medicines', require('./routes/medicines'));
app.use('/api/verify', require('./routes/verify'));
app.use('/api/pharmacies', require('./routes/pharmacies'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/history', require('./routes/history'));
app.use('/api/admin', require('./routes/admin'));

// System health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    appName: 'MedCheck BD',
    environment: process.env.NODE_ENV || 'development',
    time: new Date().toISOString(),
  });
});

// For any non-API route, serve index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Central error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;

// Connect to Database and start server
connectDB().then(async () => {
  try {
    // Check if database is empty and automatically seed
    const count = await Medicine.countDocuments();
    if (count === 0) {
      console.log('[Server] Database is empty. Running initial seed...');
      await seedDatabase();
    } else {
      console.log(`[Server] Database contains ${count} medicines ready.`);
    }

    app.listen(PORT, () => {
      console.log('====================================================');
      console.log(` MedCheck BD Server running on port ${PORT}`);
      console.log(` Web Portal: http://localhost:${PORT}`);
      console.log(` API Endpoint: http://localhost:${PORT}/api/health`);
      console.log('====================================================');
    });
  } catch (err) {
    console.error('[Server Startup Error]', err);
  }
});
