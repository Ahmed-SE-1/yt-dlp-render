const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const diskusage = require('diskusage');

const app = express();

// Configuration
const downloadsDir = process.env.RENDER ? '/var/data/downloads' : path.join(__dirname, 'downloads');
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// Rate limiting
app.use('/extract', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later'
}));

// Ensure downloads directory exists
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Serve downloaded videos
app.use('/downloads', express.static(downloadsDir));

// Enhanced health check
app.get('/health', (req, res) => {
  try {
    const diskInfo = diskusage.checkSync(downloadsDir);
    res.status(200).json({
      status: 'healthy',
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      disk: {
        free: diskInfo.free,
        total: diskInfo.total,
        downloads: fs.readdirSync(downloadsDir).length
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// [Rest of your existing routes and functions remain exactly the same...]
// ... include all your existing /extract endpoint and helper functions ...

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ 
    success: false,
    message: 'Internal server error'
  });
});

// Process management
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server terminated');
    process.exit(0);
  });
});

const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  if (!process.env.RENDER) cleanupOldFiles();
});

// [Keep all your existing timeout and interval settings...]
