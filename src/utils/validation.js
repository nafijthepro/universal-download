const validator = require('validator');
const config = require('../config/config');

function validateUrl(url) {
  try {
    // Basic URL validation
    if (!validator.isURL(url, { 
      protocols: ['http', 'https'],
      require_protocol: true
    })) {
      return { isValid: false, error: 'Invalid URL format' };
    }
    
    // Parse URL to get hostname
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Determine platform and check if supported
    let platform = 'generic';
    let isSupported = false;
    
    // YouTube
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      platform = 'youtube';
      isSupported = true;
    }
    // TikTok
    else if (hostname.includes('tiktok.com')) {
      platform = 'tiktok';
      isSupported = true;
    }
    // Instagram
    else if (hostname.includes('instagram.com')) {
      platform = 'instagram';
      isSupported = true;
    }
    // Facebook
    else if (hostname.includes('facebook.com') || hostname.includes('fb.watch')) {
      platform = 'facebook';
      isSupported = true;
    }
    // Twitter/X
    else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      platform = 'twitter';
      isSupported = true;
    }
    // Pinterest
    else if (hostname.includes('pinterest.com') || hostname.includes('pin.it')) {
      platform = 'pinterest';
      isSupported = true;
    }
    
    if (!isSupported) {
      return { 
        isValid: false, 
        error: 'Unsupported URL. Supported platforms: YouTube, TikTok, Instagram, Facebook, X/Twitter, Pinterest' 
      };
    }
    
    // Clean and normalize URL
    const cleanUrl = url.trim();
    
    return { 
      isValid: true, 
      cleanUrl,
      hostname,
      platform
    };
    
  } catch (error) {
    return { 
      isValid: false, 
      error: 'Invalid URL format' 
    };
  }
}

function sanitizeFilename(filename) {
  if (!filename) return 'download';
  
  // Remove path traversal attempts and invalid characters
  return filename
    .replace(/[^\w\s\-_.()]/g, '') // Keep only safe characters
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
    .replace(/\.\./g, '') // Remove path traversal attempts
    .replace(/^\./, '') // Remove leading dots
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .substring(0, 100) // Limit length
    .trim('_'); // Remove trailing underscores
}

module.exports = {
  validateUrl,
  sanitizeFilename
};