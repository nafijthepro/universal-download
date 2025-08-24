const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs-extra');
const cron = require('node-cron');

const downloadRoutes = require('./routes/download');
const { cleanupOldFiles } = require('./utils/fileManager');
const config = require('./config/config');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: true,
  credentials: false,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting - more generous for 2025
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // increased limit for better UX
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure downloads directory exists
fs.ensureDirSync(config.DOWNLOADS_DIR);

// Set proper permissions for downloads directory
try {
  fs.chmodSync(config.DOWNLOADS_DIR, 0o755);
} catch (error) {
  console.log('Could not set directory permissions:', error.message);
}

// Static file serving for downloads
app.use('/files', express.static(config.DOWNLOADS_DIR, {
  maxAge: '1h',
  setHeaders: (res, path) => {
    res.setHeader('Content-Disposition', 'attachment');
  }
}));

// Serve the main HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Serve static files
app.use(express.static('public'));

// API Routes
app.use('/api', downloadRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0',
    year: 2025
  });
});

// Legacy route support
app.get('/alldl', (req, res) => {
  res.redirect(301, `/api/download?${new URLSearchParams(req.query)}`);
});

app.get('/info', (req, res) => {
  res.redirect(301, `/api/info?${new URLSearchParams(req.query)}`);
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Handle specific error types
  if (err.code === 'ENOENT') {
    return res.status(404).json({ error: 'File not found' });
  }
  
  if (err.code === 'EMFILE' || err.code === 'ENFILE') {
    return res.status(503).json({ error: 'Server temporarily unavailable' });
  }
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Cleanup old files every 30 minutes
cron.schedule('*/30 * * * *', () => {
  console.log('Running cleanup job...');
  cleanupOldFiles();
});

// Initial cleanup on startup
cleanupOldFiles();

app.listen(PORT, () => {
  console.log(`🚀 AllDL Server 2025 running on port ${PORT}`);
  console.log(`📁 Downloads directory: ${config.DOWNLOADS_DIR}`);
  console.log(`🧹 Cleanup job scheduled every 30 minutes`);
  console.log(`🌐 Access at: http://localhost:${PORT}`);
});

module.exports = app;