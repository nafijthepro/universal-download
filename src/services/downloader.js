const ytdl = require('ytdl-core');
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
    
    switch (platform) {
      case 'youtube':
        return await getYouTubeInfo(url);
      case 'tiktok':
        return await getTikTokInfo(url);
      case 'instagram':
        return await getInstagramInfo(url);
      case 'facebook':
        return await getFacebookInfo(url);
      case 'twitter':
        return await getTwitterInfo(url);
      default:
        return await getGenericInfo(url);
    }
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

async function getYouTubeInfo(url) {
  try {
    const info = await ytdl.getInfo(url);
    const videoDetails = info.videoDetails;
    
    return {
      title: videoDetails.title || 'YouTube Video',
      description: (videoDetails.description || '').substring(0, 200),
      duration: parseInt(videoDetails.lengthSeconds) || null,
      uploader: videoDetails.author?.name || 'Unknown',
      thumbnail: videoDetails.thumbnails?.[0]?.url || null,
      formats: info.formats?.length || 0,
      platform: 'YouTube'
    };
  } catch (error) {
    console.error('YouTube info error:', error);
    return {
      title: 'YouTube Video',
      description: '',
      duration: null,
      uploader: 'YouTube User',
      thumbnail: null,
      formats: 1,
      platform: 'YouTube'
    };
  }
}

async function getTikTokInfo(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    const title = $('title').text() || 'TikTok Video';
    
    return {
      title: title.replace(' | TikTok', '').substring(0, 100),
      description: '',
      duration: null,
      uploader: 'TikTok User',
      thumbnail: null,
      formats: 1,
      platform: 'TikTok'
    };
  } catch (error) {
    return {
      title: 'TikTok Video',
      description: '',
      duration: null,
      uploader: 'TikTok User',
      thumbnail: null,
      formats: 1,
      platform: 'TikTok'
    };
  }
}

async function getInstagramInfo(url) {
  return {
    title: 'Instagram Media',
    description: '',
    duration: null,
    uploader: 'Instagram User',
    thumbnail: null,
    formats: 1,
    platform: 'Instagram'
  };
}

async function getFacebookInfo(url) {
  return {
    title: 'Facebook Video',
    description: '',
    duration: null,
    uploader: 'Facebook User',
    thumbnail: null,
    formats: 1,
    platform: 'Facebook'
  };
}

async function getTwitterInfo(url) {
  return {
    title: 'Twitter Video',
    description: '',
    duration: null,
    uploader: 'Twitter User',
    thumbnail: null,
    formats: 1,
    platform: 'Twitter'
  };
}

async function getGenericInfo(url) {
  return {
    title: 'Media File',
    description: '',
    duration: null,
    uploader: 'Unknown',
    thumbnail: null,
    formats: 1,
    platform: 'Generic'
  };
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
    
    let downloadResult;
    
    switch (platform) {
      case 'youtube':
        downloadResult = await downloadYouTube(url, format, quality, downloadId, info);
        break;
      default:
        downloadResult = await downloadWithYtDlp(url, format, quality, downloadId, info, platform);
    }
    
    return downloadResult;
    
  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
}

async function downloadYouTube(url, format, quality, downloadId, info) {
  return new Promise((resolve, reject) => {
    try {
      const safeTitle = sanitizeFilename(info.title.substring(0, 50)) || 'youtube_video';
      const extension = format === 'audio' ? 'mp3' : 'mp4';
      const filename = `${safeTitle}_${downloadId}.${extension}`;
      const filepath = path.join(config.DOWNLOADS_DIR, filename);
      
      let ytdlOptions = {
        quality: 'highestvideo+bestaudio/best',
        filter: format === 'audio' ? 'audioonly' : undefined
      };
      
      if (format === 'audio') {
        ytdlOptions.quality = 'highestaudio';
        ytdlOptions.filter = 'audioonly';
      } else {
        // Set quality based on user preference
        switch (quality) {
          case 'high':
            ytdlOptions.quality = 'best[height<=1080]';
            break;
          case 'medium':
            ytdlOptions.quality = 'best[height<=720]';
            break;
          case 'low':
            ytdlOptions.quality = 'best[height<=480]';
            break;
          case 'lowest':
            ytdlOptions.quality = 'worst';
            break;
          default:
            ytdlOptions.quality = 'best';
        }
      }
      
      const stream = ytdl(url, ytdlOptions);
      const writeStream = fs.createWriteStream(filepath);
      
      stream.pipe(writeStream);
      
      let downloadStarted = false;
      
      stream.on('info', (info) => {
        console.log('Download started:', info.videoDetails.title);
        downloadStarted = true;
      });
      
      stream.on('error', (error) => {
        console.error('YouTube download stream error:', error);
        fs.remove(filepath).catch(() => {});
        reject(new Error(`YouTube download failed: ${error.message}`));
      });
      
      writeStream.on('error', (error) => {
        console.error('Write stream error:', error);
        fs.remove(filepath).catch(() => {});
        reject(new Error(`File write error: ${error.message}`));
      });
      
      writeStream.on('finish', async () => {
        try {
          const stats = await fs.stat(filepath);
          if (stats.size === 0) {
            await fs.remove(filepath);
            reject(new Error('Downloaded file is empty'));
            return;
          }
          
          const baseUrl = config.BASE_URL;
          const downloadUrl = `${baseUrl}/files/${filename}`;
          
          console.log(`YouTube download completed: ${filename} (${stats.size} bytes)`);
          
          resolve({
            success: true,
            result: downloadUrl,
            title: info.title,
            filename: filename,
            size: stats.size,
            format: format,
            quality: quality,
            platform: 'YouTube'
          });
        } catch (error) {
          reject(error);
        }
      });
      
      // Timeout after 3 minutes
      setTimeout(() => {
        if (!downloadStarted) {
          stream.destroy();
          writeStream.destroy();
          fs.remove(filepath).catch(() => {});
          reject(new Error('Download timeout - no response from server'));
        }
      }, 180000);
      
    } catch (error) {
      reject(new Error(`YouTube download setup error: ${error.message}`));
    }
  });
}

async function downloadWithYtDlp(url, format, quality, downloadId, info, platform) {
  return new Promise((resolve, reject) => {
    try {
      const safeTitle = sanitizeFilename(info.title.substring(0, 50)) || 'media_file';
      const extension = format === 'audio' ? 'mp3' : 'mp4';
      const filename = `${safeTitle}_${downloadId}.%(ext)s`;
      const outputTemplate = path.join(config.DOWNLOADS_DIR, filename);
      
      let formatSelector;
      if (format === 'audio') {
        formatSelector = 'bestaudio[ext=mp3]/bestaudio/best[ext=m4a]/best';
      } else {
        switch (quality) {
          case 'highest':
            formatSelector = 'best[ext=mp4]/best';
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
      
      const args = [
        '--format', formatSelector,
        '--output', outputTemplate,
        '--no-playlist',
        '--max-filesize', '200M',
        '--socket-timeout', '30',
        '--retries', '3',
        '--no-warnings',
        url
      ];
      
      if (format === 'audio') {
        args.push('--extract-audio', '--audio-format', 'mp3');
      }
      
      console.log(`Using yt-dlp for ${platform}:`, args.join(' '));
      
      const ytDlp = spawn('yt-dlp', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let errorOutput = '';
      
      ytDlp.stdout.on('data', (data) => {
        output += data.toString();
        console.log('yt-dlp output:', data.toString().trim());
      });
      
      ytDlp.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error('yt-dlp error:', data.toString().trim());
      });
      
      ytDlp.on('close', async (code) => {
        try {
          if (code !== 0) {
            throw new Error(`yt-dlp failed with code ${code}: ${errorOutput}`);
          }
          
          // Find the downloaded file
          const files = await fs.readdir(config.DOWNLOADS_DIR);
          const downloadedFile = files.find(file => file.includes(downloadId));
          
          if (!downloadedFile) {
            throw new Error('Downloaded file not found');
          }
          
          const finalPath = path.join(config.DOWNLOADS_DIR, downloadedFile);
          const stats = await fs.stat(finalPath);
          
          if (stats.size === 0) {
            await fs.remove(finalPath);
            throw new Error('Downloaded file is empty');
          }
          
          const baseUrl = config.BASE_URL;
          const downloadUrl = `${baseUrl}/files/${downloadedFile}`;
          
          console.log(`${platform} download completed: ${downloadedFile} (${stats.size} bytes)`);
          
          resolve({
            success: true,
            result: downloadUrl,
            title: info.title,
            filename: downloadedFile,
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
        reject(new Error(`Failed to start yt-dlp: ${error.message}`));
      });
      
      // Timeout after 5 minutes
      setTimeout(() => {
        ytDlp.kill('SIGTERM');
        reject(new Error('Download timeout'));
      }, 300000);
      
    } catch (error) {
      reject(new Error(`${platform} download setup error: ${error.message}`));
    }
  });
}

module.exports = {
  getMediaInfo,
  downloadMedia
};