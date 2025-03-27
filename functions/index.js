const functions = require('firebase-functions');
const express = require('express');
const app = express();

// Import your server code
const serverApp = require('../dist/index.js');

// Use your Express app
app.use(serverApp);

// Export the Cloud Function
exports.api = functions.https.onRequest(app);