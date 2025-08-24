class VideoDownloader {
    constructor() {
        this.form = document.getElementById('downloadForm');
        this.urlInput = document.getElementById('urlInput');
        this.qualitySelect = document.getElementById('qualitySelect');
        this.formatSelect = document.getElementById('formatSelect');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.btnContent = document.querySelector('.btn-content');
        this.spinner = document.getElementById('spinner');
        this.alertBox = document.getElementById('alertBox');
        this.mediaInfo = document.getElementById('mediaInfo');
        this.urlError = document.getElementById('urlError');

        this.supportedDomains = [
            'youtube.com', 'youtu.be', 'm.youtube.com',
            'tiktok.com', 'vt.tiktok.com', 'vm.tiktok.com',
            'instagram.com', 'www.instagram.com',
            'facebook.com', 'www.facebook.com', 'fb.watch', 'm.facebook.com',
            'twitter.com', 'x.com', 'mobile.twitter.com',
            'pinterest.com', 'pin.it'
        ];

        this.init();
    }

    init() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        this.urlInput.addEventListener('input', this.validateUrl.bind(this));
        this.urlInput.addEventListener('paste', this.handlePaste.bind(this));
        
        // Auto-focus URL input
        this.urlInput.focus();
        
        // Add keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboard.bind(this));
        
        console.log('AllDL 2025 initialized successfully');
    }

    handleKeyboard(e) {
        // Ctrl/Cmd + Enter to download
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            this.form.dispatchEvent(new Event('submit'));
        }
    }

    handlePaste(e) {
        // Auto-validate after paste
        setTimeout(() => {
            this.validateUrl();
        }, 100);
    }

    validateUrl() {
        const url = this.urlInput.value.trim();
        this.urlError.textContent = '';

        if (!url) {
            return true;
        }

        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();

            const isSupported = this.supportedDomains.some(domain => 
                hostname === domain || hostname.endsWith('.' + domain)
            );

            if (!isSupported) {
                this.urlError.textContent = '❌ Unsupported platform. Please use YouTube, TikTok, Instagram, Facebook, X/Twitter, or Pinterest URLs.';
                return false;
            }

            this.urlError.innerHTML = '✅ <span style="color: #059669;">Supported platform detected!</span>';
            return true;
        } catch (error) {
            this.urlError.textContent = '❌ Please enter a valid URL.';
            return false;
        }
    }

    async handleSubmit(e) {
        e.preventDefault();

        if (!this.validateUrl()) {
            this.urlInput.focus();
            return;
        }

        const url = this.urlInput.value.trim();
        const quality = this.qualitySelect.value;
        const format = this.formatSelect.value;

        this.setLoading(true);
        this.hideAlert();
        this.hideMediaInfo();

        try {
            console.log('Starting download process...', { url, quality, format });
            
            // First, get media info
            await this.getMediaInfo(url);

            // Then download
            const response = await this.downloadMedia(url, quality, format);
            
            if (response.success && response.result) {
                this.showSuccess(`🎉 Download ready! File: ${response.filename}`);
                
                // Auto-download after 2 seconds
                setTimeout(() => {
                    this.openDownload(response.result, response.filename);
                }, 2000);
                
                // Show download button
                this.showDownloadButton(response.result, response.filename);
            } else {
                throw new Error(response.error || 'Download failed');
            }

        } catch (error) {
            console.error('Download error:', error);
            this.showError(`❌ ${error.message || 'Download failed. Please try again.'}`);
        } finally {
            this.setLoading(false);
        }
    }

    async getMediaInfo(url) {
        try {
            console.log('Fetching media info...');
            const response = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
            const data = await response.json();

            if (response.ok && data.title) {
                this.showMediaInfo(data);
                console.log('Media info loaded:', data);
            }
        } catch (error) {
            console.log('Could not fetch media info:', error);
        }
    }

    async downloadMedia(url, quality, format) {
        const params = new URLSearchParams({
            url: url,
            quality: quality,
            format: format
        });

        console.log('Sending download request...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
        
        const response = await fetch(`/api/download?${params}`, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        clearTimeout(timeoutId);
        const data = await response.json();

        console.log('Download response:', data);

        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        return data;
    }

    showMediaInfo(info) {
        const formatFileSize = (bytes) => {
            if (!bytes) return 'Unknown';
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            if (bytes === 0) return '0 Bytes';
            const i = Math.floor(Math.log(bytes) / Math.log(1024));
            return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
        };

        const formatDuration = (seconds) => {
            if (!seconds) return 'Unknown';
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        this.mediaInfo.innerHTML = `
            <h3>📋 Media Information</h3>
            <div class="info-item">
                <span class="info-label">📺 Title:</span>
                <span class="info-value">${info.title || 'Unknown'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">👤 Uploader:</span>
                <span class="info-value">${info.uploader || 'Unknown'}</span>
            </div>
            ${info.duration ? `
            <div class="info-item">
                <span class="info-label">⏱️ Duration:</span>
                <span class="info-value">${formatDuration(info.duration)}</span>
            </div>
            ` : ''}
            <div class="info-item">
                <span class="info-label">🌐 Platform:</span>
                <span class="info-value">${info.platform || 'Unknown'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">📊 Formats:</span>
                <span class="info-value">${info.formats || 'Unknown'}</span>
            </div>
        `;
        this.mediaInfo.classList.add('show');
    }

    hideMediaInfo() {
        this.mediaInfo.classList.remove('show');
    }

    setLoading(loading) {
        this.downloadBtn.disabled = loading;
        
        if (loading) {
            this.btnContent.classList.add('loading');
            this.spinner.classList.add('loading');
        } else {
            this.btnContent.classList.remove('loading');
            this.spinner.classList.remove('loading');
        }
    }

    showSuccess(message) {
        this.alertBox.className = 'alert success';
        this.alertBox.innerHTML = message;
        this.alertBox.style.display = 'block';
    }

    showError(message) {
        this.alertBox.className = 'alert error';
        this.alertBox.innerHTML = message;
        this.alertBox.style.display = 'block';
    }

    hideAlert() {
        this.alertBox.className = 'alert';
        this.alertBox.style.display = 'none';
    }

    showDownloadButton(url, filename) {
        const downloadButton = document.createElement('button');
        downloadButton.className = 'download-btn';
        downloadButton.style.marginTop = '16px';
        downloadButton.style.background = 'var(--success-gradient)';
        downloadButton.innerHTML = `
            <span class="btn-content">
                <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
                <span class="btn-text">Download ${filename}</span>
            </span>
        `;
        
        downloadButton.addEventListener('click', () => {
            this.openDownload(url, filename);
        });
        
        // Remove existing download button if any
        const existingBtn = this.alertBox.querySelector('.download-btn');
        if (existingBtn) {
            existingBtn.remove();
        }
        
        this.alertBox.appendChild(downloadButton);
    }

    openDownload(url, filename) {
        console.log('Opening download:', url);
        
        // Create a temporary link and click it
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Show success message
        this.showSuccess(`🚀 Download started! Check your downloads folder for: ${filename}`);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 AllDL 2025 - Universal Video Downloader');
    console.log('✨ Optimized for modern browsers and fast downloads');
    
    new VideoDownloader();
    
    // Add some visual feedback
    const cards = document.querySelectorAll('.platform');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const platform = card.textContent.trim();
            console.log(`Platform selected: ${platform}`);
        });
    });
});