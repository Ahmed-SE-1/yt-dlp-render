# Use Python as base for yt-dlp, with ffmpeg and Node.js
FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    gnupg \
    ca-certificates \
    build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir yt-dlp

# Install Node.js 18
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create persistent storage directory
RUN mkdir -p /var/data/downloads

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --production && npm install diskusage express-rate-limit

# Copy remaining files
COPY . .

# Clean up build dependencies
RUN apt-get purge -y --auto-remove curl gnupg build-essential \
    && apt-get clean

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the app
CMD ["node", "server.js"]
