FROM node:20-alpine

# Install system dependencies including yt-dlp
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    curl \
    wget \
    && pip3 install --no-cache-dir yt-dlp

# Verify yt-dlp installation
RUN yt-dlp --version

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create directories for downloads and temp files
RUN mkdir -p /app/downloads /tmp && \
    chmod 755 /app/downloads

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DOWNLOADS_DIR=/app/downloads
ENV TEMP_DIR=/tmp

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]