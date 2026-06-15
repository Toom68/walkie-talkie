const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DOWNLOADS_DIR = path.join(__dirname, 'public', 'downloads');

app.use(express.static(path.join(__dirname, 'public')));

// API to check which downloads are available
app.get('/api/downloads', (req, res) => {
  const apkPath = path.join(DOWNLOADS_DIR, 'WalkieTalkie.apk');
  const ipaPath = path.join(DOWNLOADS_DIR, 'WalkieTalkie.ipa');
  
  const apkExists = fs.existsSync(apkPath);
  const ipaExists = fs.existsSync(ipaPath);
  
  res.json({
    android: {
      available: apkExists,
      url: apkExists ? '/downloads/WalkieTalkie.apk' : null,
      size: apkExists ? formatSize(fs.statSync(apkPath).size) : null
    },
    ios: {
      available: ipaExists,
      url: ipaExists ? '/downloads/WalkieTalkie.ipa' : null,
      size: ipaExists ? formatSize(fs.statSync(ipaPath).size) : null
    }
  });
});

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`WalkieTalkie web running on port ${PORT}`);
});
