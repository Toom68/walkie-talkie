const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  const route = event.path.replace('/.netlify/functions/api', '').replace('/api', '');

  if (route === '/downloads' || route === '/downloads/') {
    const publicDir = path.join(__dirname, '..', 'public', 'downloads');
    
    const apkPath = path.join(publicDir, 'WalkieTalkie.apk');
    const ipaPath = path.join(publicDir, 'WalkieTalkie.ipa');

    const apkExists = fs.existsSync(apkPath);
    const ipaExists = fs.existsSync(ipaPath);

    const formatSize = (bytes) => {
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      })
    };
  }

  return { statusCode: 404, body: 'Not found' };
};
