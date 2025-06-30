# Use Python as base for yt-dlp, with ffmpeg and Node.js
FROM python:3.10-slim

# Install dependencies for Node.js, ffmpeg, yt-dlp
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    gnupg \
    ca-certificates \
    build-essential && \
    pip install --no-cache-dir yt-dlp

# Install Node.js 18
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Install Node.js dependencies
RUN npm install

# Expose port expected by Railway
EXPOSE 3000

# Start the app
CMD ["node", "server.js"]
