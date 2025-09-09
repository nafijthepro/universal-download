const express = require('express');
const { downloadMedia, getMediaInfo } = require('../services/downloader');
const { validateUrl } = require('../utils/validation');

const router = express.Router();

// Main download endpoint
router.get('/download', async (req, res) => {
  try {
    const { url, format, quality } = req.query;
    
    // Validate URL parameter
    if (!url) {
      return res.status(400).json({ 
        error: 'Missing required parameter: url' 
      });
    }
    
    // Validate format parameter
    if (format && !['video', 'audio'].includes(format)) {
      return res.status(400).json({ 
        error: 'Invalid format. Must be "video" or "audio"' 
      });
    }
    
    // Validate quality parameter
    const validQualities = ['highest', 'high', 'medium', 'low', 'lowest', '1080p', '720p', '480p', '360p'];
    if (quality && !validQualities.includes(quality)) {
      return res.status(400).json({ 
        error: `Invalid quality. Must be one of: ${validQualities.join(', ')}` 
      });
    }
    
    // Validate and sanitize URL
    const validation = validateUrl(url);
    if (!validation.isValid) {
      return res.status(400).json({ 
        error: validation.error 
      });
    }
    
    console.log(`Download request: ${validation.cleanUrl} | Format: ${format || 'video'} | Quality: ${quality || 'highest'}`);
    
    // Download the media
    const result = await downloadMedia(validation.cleanUrl, {
      format: format || 'video',
      quality: quality || 'highest',
      platform: validation.platform
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('Download error:', error);
    
    if (error.message.includes('Unsupported URL')) {
      return res.status(400).json({ error: error.message });
    }
    
    if (error.message.includes('timeout')) {
      return res.status(408).json({ error: 'Request timeout - please try again' });
    }
    
    if (error.message.includes('too large')) {
      return res.status(413).json({ error: 'File is too large to download' });
    }
    
    if (error.message.includes('No video formats found') || 
        error.message.includes('Video unavailable') || 
        error.message.includes('unavailable or private') ||
        error.message.includes('not available') ||
        error.message.includes('Sign in to confirm')) {
      return res.status(404).json({ error: 'Content not found or unavailable' });
    }
    
    if (error.message.includes('Private video') || 
        error.message.includes('Access denied') ||
        error.message.includes('restricted')) {
      return res.status(403).json({ error: 'Cannot download private content' });
    }
    
    if (error.message.includes('yt-dlp is installed')) {
      return res.status(500).json({ error: 'Server configuration error - yt-dlp not available' });
    }
    
    res.status(500).json({ 
      error: 'Download failed',
      message: error.message 
    });
  }
});

// Get file info endpoint
router.get('/info', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ 
        error: 'Missing required parameter: url' 
      });
    }
    
    const validation = validateUrl(url);
    if (!validation.isValid) {
      return res.status(400).json({ 
        error: validation.error 
      });
    }
    
    console.log(`Info request: ${validation.cleanUrl} | Platform: ${validation.platform}`);
    
    const info = await getMediaInfo(validation.cleanUrl, validation.platform);
    
    res.json(info);
    
  } catch (error) {
    console.error('Info error:', error);
    res.status(500).json({ 
      error: 'Failed to get media info',
      message: error.message 
    });
  }
});

// Test endpoint
router.get('/test', (req, res) => {
  res.json({
    status: 'API Working',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    supportedPlatforms: ['YouTube', 'TikTok', 'Instagram', 'Facebook', 'Twitter/X', 'Pinterest']
  });
});

module.exports = router;