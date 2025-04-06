require('dotenv').config();
const fs = require('fs');
const path = require('path');

const configContent = `window.env = {
  FIREBASE_API_KEY: '${process.env.FIREBASE_API_KEY}',
  FIREBASE_AUTH_DOMAIN: '${process.env.FIREBASE_AUTH_DOMAIN}',
  FIREBASE_PROJECT_ID: '${process.env.FIREBASE_PROJECT_ID}',
  FIREBASE_STORAGE_BUCKET: '${process.env.FIREBASE_STORAGE_BUCKET}',
  FIREBASE_MESSAGING_SENDER_ID: '${process.env.FIREBASE_MESSAGING_SENDER_ID}',
  FIREBASE_APP_ID: '${process.env.FIREBASE_APP_ID}'
};`;

const configPath = path.join(__dirname, 'public', 'config.js');
fs.writeFileSync(configPath, configContent);
console.log('Config file generated successfully!'); 