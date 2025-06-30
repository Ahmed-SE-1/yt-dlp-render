const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from "downloads" folder
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}
app.use('/downloads', express.static(downloadsDir));

app.post('/extract', (req, res) => {
  const { url } = req.body;
  console.log(`📥 Received request to extract: ${url}`);

  if (!url) {
    return res.status(400).json({ success: false, message: 'URL is required' });
  }

  const timestamp = Date.now();
  const outputFile = `downloads/video_${timestamp}.mp4`;

  let cmd = `yt-dlp -f best --merge-output-format mp4 -o "${outputFile}" --no-check-certificate`;

  // ✅ Detect platform and apply relevant headers
  if (url.includes('tiktok.com')) {
    cmd += ` --add-header "User-Agent: Mozilla/5.0" --add-header "Referer: https://www.tiktok.com/"`;
  }

  cmd += ` "${url}"`;

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Extraction error: ${stderr || error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Extraction failed',
        error: stderr || error.message
      });
    }

    const fileUrl = `http://${req.headers.host}/${outputFile.replace(/\\/g, '/')}`;
    console.log(`✅ Video ready at: ${fileUrl}`);
    res.json({ success: true, url: fileUrl });
  });
});


app.listen(3000, () => {
  console.log('✅ Video Downloader API running at http://localhost:3000');
});
