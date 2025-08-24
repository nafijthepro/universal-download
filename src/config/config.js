const path = require('path');

module.exports = {
  // Directory configuration
  DOWNLOADS_DIR: process.env.DOWNLOADS_DIR || '/tmp/downloads',
  TEMP_DIR: process.env.TEMP_DIR || '/tmp',
  
  // File configuration
  MAX_FILE_SIZE: process.env.MAX_FILE_SIZE || '200M',
  FILE_RETENTION_HOURS: parseInt(process.env.FILE_RETENTION_HOURS) || 2,
  
  // Supported domains - Updated for 2025
  SUPPORTED_DOMAINS: [
    // YouTube
    'youtu.be',
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    
    // TikTok
    'tiktok.com',
    'www.tiktok.com',
    'vt.tiktok.com',
    'vm.tiktok.com',
    
    // Instagram
    'instagram.com',
    'www.instagram.com',
    
    // Facebook
    'facebook.com',
    'www.facebook.com',
    'fb.watch',
    'm.facebook.com',
    
    // Twitter/X
    'twitter.com',
    'www.twitter.com',
    'x.com',
    'www.x.com',
    'mobile.twitter.com',
    
    // Pinterest
    'pinterest.com',
    'www.pinterest.com',
    'pin.it'
  ],
  
  // Server configuration
  BASE_URL: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  
  // API configuration
  API_TIMEOUT: 180000, // 3 minutes
  DOWNLOAD_TIMEOUT: 300000, // 5 minutes
  
  // Quality mappings
  QUALITY_MAPPINGS: {
    'highest': 'best',
    'high': '1080p',
    'medium': '720p',
    'low': '480p',
    'lowest': '360p'
  }
};