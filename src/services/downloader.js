const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const cheerio = require('cheerio');
const { spawn } = require('child_process');
const config = require('../config/config');
const { sanitizeFilename } = require('../utils/validation');

async function getMediaInfo(url, platform) {
  try {
    console.log(`Getting info for ${platform}: ${url}`);
    
    // Use yt-dlp for all platforms for better reliability
    return await getInfoWithYtDlp(url, platform);
  } catch (error) {
    console.error('Info error:', error);
    return {
      title: 'Media File',
      description: '',
      duration: null,
      uploader: 'Unknown',
      thumbnail: null,
      formats: 1,
      platform: platform || 'Unknown'
    };
  }
}

async function getInfoWithYtDlp(url, platform) {
  return new Promise((resolve, reject) => {
    const args = [
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      url
    ];
    
    console.log('Getting info with yt-dlp:', args.join(' '));
    
    const ytDlp = spawn('yt-dlp', args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    ytDlp.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ytDlp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    ytDlp.on('close', (code) => {
      try {
        if (code !== 0) {
          console.error('yt-dlp info error:', errorOutput);
          throw new Error(`Failed to get info: ${errorOutput}`);
        }
        
        const info = JSON.parse(output.trim());
        
        resolve({
          title: info.title || 'Media File',
          description: (info.description || '').substring(0, 200),
          duration: info.duration || null,
          uploader: info.uploader || info.channel || 'Unknown',
          thumbnail: info.thumbnail || null,
          formats: info.formats ? info.formats.length : 1,
          platform: platform || 'Unknown'
        });
        
      } catch (error) {
        console.error('Failed to parse yt-dlp info:', error);
        resolve({
          title: 'Media File',
          description: '',
          duration: null,
          uploader: 'Unknown',
          thumbnail: null,
          formats: 1,
          platform: platform || 'Unknown'
        });
      }
    });
    
    ytDlp.on('error', (error) => {
      console.error('yt-dlp spawn error:', error);
      reject(error);
    });
    
    // Timeout after 30 seconds for info
    setTimeout(() => {
      ytDlp.kill('SIGTERM');
      reject(new Error('Info request timeout'));
    }, 30000);
  });
}

async function downloadMedia(url, options = {}) {
  const { format = 'video', quality = 'highest', platform } = options;
  const downloadId = uuidv4();
  
  console.log(`Starting download: ${url} | Platform: ${platform} | Format: ${format} | Quality: ${quality}`);
  
  try {
    let info;
    try {
      info = await getMediaInfo(url, platform);
    } catch (error) {
      console.log('Info fetch failed, using fallback');
      info = { title: 'Downloaded_Media', platform: platform || 'Unknown' };
    }
    
    // Use yt-dlp for all downloads for better reliability
    const downloadResult = await downloadWithYtDlp(url, format, quality, downloadId, info, platform);
    
    return downloadResult;
    
  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
}

async function downloadWithYtDlp(url, format, quality, downloadId, info, platform) {
  return new Promise((resolve, reject) => {
    try {
      const safeTitle = sanitizeFilename(info.title.substring(0, 50)) || 'media_file';
      const timestamp = Date.now();
      const baseFilename = `${safeTitle}_${timestamp}_${downloadId.substring(0, 8)}`;
      
      let formatSelector;
      let outputExtension;
      
      if (format === 'audio') {
        formatSelector = 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio/best[ext=m4a]/best';
        outputExtension = 'm4a';
      } else {
        outputExtension = 'mp4';
        switch (quality) {
          case 'highest':
            formatSelector = 'best[ext=mp4]/best[height<=2160]/best';
            break;
          case 'high':
            formatSelector = 'best[height<=1080][ext=mp4]/best[height<=1080]/best[ext=mp4]/best';
            break;
          case 'medium':
            formatSelector = 'best[height<=720][ext=mp4]/best[height<=720]/best[ext=mp4]/best';
            break;
          case 'low':
            formatSelector = 'best[height<=480][ext=mp4]/best[height<=480]/best[ext=mp4]/best';
            break;
          case 'lowest':
            formatSelector = 'worst[ext=mp4]/worst';
            break;
          default:
            formatSelector = 'best[ext=mp4]/best';
        }
      }
      
      const finalFilename = `${baseFilename}.${outputExtension}`;
      const outputPath = path.join(config.DOWNLOADS_DIR, finalFilename);
      
      const args = [
        '--format', formatSelector,
        '--output', outputPath,
        '--no-playlist',
        '--max-filesize', '100M',
        '--socket-timeout', '60',
        '--retries', '2',
        '--fragment-retries', '2',
        '--no-warnings',
        '--no-check-certificates',
        '--prefer-ffmpeg',
        '--no-call-home',
        '--no-check-certificate',
        url
      ];
      
      // Add audio extraction for audio format
      if (format === 'audio') {
        args.push('--extract-audio');
        args.push('--audio-format');
        args.push('m4a');
        args.push('--audio-quality');
        args.push('0'); // Best quality
      }
      
      // Add additional options for better compatibility
      if (platform === 'youtube') {
        args.push('--extractor-args', 'youtube:player_client=android');
        args.push('--user-agent', 'com.google.android.youtube/17.31.35 (Linux; U; Android 11) gzip');
        args.push('--add-header', 'Accept-Language:en-US,en;q=0.9');
      }
      
      console.log(`Using yt-dlp for ${platform}:`, args.slice(0, -1).join(' '), '[URL]');
      
      const ytDlp = spawn('yt-dlp', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });
      
      let output = '';
      let errorOutput = '';
      let downloadStarted = false;
      
      ytDlp.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        
        if (text.includes('[download]') && text.includes('%')) {
          downloadStarted = true;
          console.log('Download progress:', text.trim());
        }
      });
      
      ytDlp.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        
        // Don't log warnings as errors
        if (!text.includes('WARNING') && !text.includes('ffmpeg')) {
          console.error('yt-dlp error:', text.trim());
        }
      });
      
      ytDlp.on('close', async (code) => {
        try {
          if (code !== 0) {
            // Clean up any partial files
            try {
              await fs.remove(outputPath);
            } catch (e) {}
            
            let errorMessage = `Download failed with exit code ${code}`;
            
            console.error(`yt-dlp failed with code ${code}:`, errorOutput);
            
            if (errorOutput.includes('Video unavailable') || errorOutput.includes('not available')) {
              errorMessage = 'Video is unavailable or private';
            } else if (errorOutput.includes('Sign in to confirm') || errorOutput.includes('bot')) {
              errorMessage = 'Video requires sign-in or is age-restricted';
            } else if (errorOutput.includes('Private video')) {
              errorMessage = 'Cannot download private video';
            } else if (errorOutput.includes('not available') || errorOutput.includes('region')) {
              errorMessage = 'Video is not available in your region';
            } else if (errorOutput.includes('HTTP Error 403')) {
              errorMessage = 'Access denied - video may be restricted';
            } else if (errorOutput.includes('No video formats found')) {
              errorMessage = 'No downloadable formats found';
            } else if (errorOutput.includes('Unsupported URL')) {
              errorMessage = 'Unsupported URL or platform';
            } else if (errorOutput.includes('ERROR')) {
              // Extract the actual error message
              const errorMatch = errorOutput.match(/ERROR: (.+?)(?:\n|$)/);
              if (errorMatch) {
                errorMessage = errorMatch[1];
              }
            }
            
            throw new Error(errorMessage);
          }
          
          // Check if file exists and has content
          if (!await fs.pathExists(outputPath)) {
            throw new Error('Downloaded file not found');
          }
          
          const stats = await fs.stat(outputPath);
          
          if (stats.size === 0) {
            await fs.remove(outputPath);
            throw new Error('Downloaded file is empty');
          }
          
          // Verify minimum file size (1KB)
          if (stats.size < 1024) {
            await fs.remove(outputPath);
            throw new Error('Downloaded file is too small, likely corrupted');
          }
          
          const baseUrl = config.BASE_URL;
          const downloadUrl = `${baseUrl}/files/${finalFilename}`;
          
          console.log(`${platform} download completed: ${finalFilename} (${formatFileSize(stats.size)})`);
          
          resolve({
            success: true,
            result: downloadUrl,
            title: info.title,
            filename: finalFilename,
            size: stats.size,
            format: format,
            quality: quality,
            platform: platform
          });
          
        } catch (error) {
          console.error(`${platform} download error:`, error);
          reject(new Error(`${platform} download failed: ${error.message}`));
        }
      });
      
      ytDlp.on('error', (error) => {
        console.error('yt-dlp spawn error:', error);
        reject(new Error(`Failed to start yt-dlp: ${error.message}. Make sure yt-dlp is installed.`));
      });
      
      // Extended timeout for larger files
      const timeout = setTimeout(() => {
        if (!downloadStarted) {
          ytDlp.kill('SIGTERM');
          reject(new Error('Download timeout - server took too long to respond'));
        } else {
          // If download started, give more time
          setTimeout(() => {
            ytDlp.kill('SIGTERM');
            reject(new Error('Download timeout - file too large or slow connection'));
          }, 180000); // Additional 3 minutes
        }
      
      ytDlp.on('close', () => {
        clearTimeout(timeout);
      });
      
    } catch (error) {
      reject(new Error(`${platform} download setup error: ${error.message}`));
    }
  });
}

function formatFileSize(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

module.exports = {
  getMediaInfo,
  downloadMedia
};