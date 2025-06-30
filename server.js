const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();

// Middleware setup with request logging
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// Ensure downloads directory exists
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Serve downloaded videos
app.use('/downloads', express.static(downloadsDir));

// Enhanced health check endpoint
app.get('/health', (req, res) => {
  const healthCheck = {
    status: 'healthy',
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    load: process.cpuUsage(),
    disk: {
      downloads: fs.readdirSync(downloadsDir).length
    }
  };
  res.status(200).json(healthCheck);
});

// Main extraction endpoint with improved performance
app.post('/extract', async (req, res) => {
  const { url } = req.body;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Valid URL is required' 
    });
  }

  console.log(`📥 Processing URL: ${url}`);
  const platform = getPlatform(url);

  try {
    const timeoutMs = getTimeoutForPlatform(platform);
    const result = await Promise.race([
      extractVideoUrl(url, platform, req),
      timeout(timeoutMs, 'Processing timeout exceeded')
    ]);

    res.json(result);
  } catch (error) {
    handleExtractionError(error, res, platform);
  }
});

// Helper functions
function getPlatform(url) {
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('instagram.com')) return 'instagram';
  return 'unknown';
}

function getTimeoutForPlatform(platform) {
  const timeouts = {
    'tiktok': 30000,
    'youtube': 45000,
    'instagram': 35000,
    'default': 20000
  };
  return timeouts[platform] || timeouts.default;
}

async function extractVideoUrl(url, platform, req) {
  const timestamp = Date.now();
  const filename = `video_${timestamp}.mp4`;
  const outputPath = path.join(downloadsDir, filename);

  let cmd = `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 -o "${outputPath}"`;

  // Platform-specific configurations
  switch (platform) {
    case 'tiktok':
      cmd += ` --add-header "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"`;
      cmd += ` --add-header "Referer: https://www.tiktok.com/"`;
      break;
    case 'youtube':
      cmd += ` --add-header "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"`;
      cmd += ` --cookies ./cookies.txt`; 
      cmd += ` --geo-bypass`;
      cmd += ` --embed-metadata`;
      cmd += ` --no-check-certificate`;
      break;
    case 'instagram':
      cmd += ` --add-header "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"`;
      break;
    default:
      cmd += ` --no-check-certificate`;
  }

  cmd += ` "${url}"`;

  console.log(`Executing command: ${cmd}`);
  await execAsync(cmd);

  if (!fs.existsSync(outputPath)) {
    throw new Error('Downloaded file not found');
  }

  const fileUrl = `${req.protocol}://${req.get('host')}/downloads/${filename}`;
  console.log(`✅ Video downloaded and available at: ${fileUrl}`);

  return {
    success: true,
    url: fileUrl,
    platform,
    filename,
    size: fs.statSync(outputPath).size
  };
}

function handleExtractionError(error, res, platform) {
  console.error('Extraction failed:', error.message);

  const errorMap = {
    'timeout': {
      status: 504,
      message: `${platform.charAt(0).toUpperCase() + platform.slice(1)} processing timeout. Please try again.`
    },
    'No downloadable': {
      status: 404,
      message: 'No video found at this URL'
    },
    'Unsupported URL': {
      status: 400,
      message: 'Unsupported video platform'
    },
    'file not found': {
      status: 500,
      message: 'Video downloaded but file could not be accessed'
    },
    'default': {
      status: 500,
      message: 'Video extraction failed'
    }
  };

  const matchedError = Object.entries(errorMap).find(([key]) => 
    error.message.includes(key)
  ) || ['default', errorMap.default];

  res.status(matchedError[1].status).json({
    success: false,
    message: matchedError[1].message,
    error: error.message,
    platform
  });
}

function timeout(ms, message) {
  return new Promise((_, reject) => 
    setTimeout(() => reject(new Error(message)), ms)
  );
}

function execAsync(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        const errorMsg = stderr || error.message;
        console.error(`Command error: ${errorMsg}`);
        reject(new Error(errorMsg));
      } else {
        console.log(`Command output: ${stdout}`);
        resolve({ stdout });
      }
    });
  });
}

function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

// Cleanup old files (optional)
function cleanupOldFiles() {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  fs.readdirSync(downloadsDir).forEach(file => {
    const filePath = path.join(downloadsDir, file);
    const stat = fs.statSync(filePath);
    if (now - stat.mtimeMs > maxAge) {
      fs.unlinkSync(filePath);
      console.log(`Deleted old file: ${file}`);
    }
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ 
    success: false,
    message: 'Internal server error'
  });
});

// Process monitoring
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

// Server configuration
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  cleanupOldFiles();
  // Schedule regular cleanup
  setInterval(cleanupOldFiles, 6 * 60 * 60 * 1000); // Every 6 hours
});

// Timeout settings
server.timeout = 60000;
server.keepAliveTimeout = 55000;
server.headersTimeout = 56000;

// Performance monitoring
setInterval(() => {
  console.log('Performance metrics:', {
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    uptime: process.uptime(),
    downloadsCount: fs.readdirSync(downloadsDir).length
  });
}, 60000); // Every 60 seconds
