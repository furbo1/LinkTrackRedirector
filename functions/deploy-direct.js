// Simple direct deployment script
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== FIREBASE FUNCTIONS DIRECT DEPLOYMENT ===');

// Update index.js with RTDB code
console.log('1. Preparing to update index.js with RTDB integration...');

try {
  // Read current index.js
  const indexPath = path.join(__dirname, 'index.js');
  let indexContent = fs.readFileSync(indexPath, 'utf8');
  console.log('Original index.js loaded successfully');
  
  // Check if RTDB code is already present
  if (indexContent.includes('const clicksRef = admin.database().ref(\'clicks\');')) {
    console.log('RTDB code already present in index.js, skipping modification');
  } else {
    console.log('Adding RTDB code to index.js...');
    
    // Add RTDB initialization after admin.initializeApp()
    indexContent = indexContent.replace(
      'admin.initializeApp();',
      'admin.initializeApp();\n\n// Initialize Realtime Database for click tracking\nconst clicksRef = admin.database().ref(\'clicks\');\nconsole.log(\'Initialized Realtime Database for clicks\');'
    );
    
    // Replace trackClick function
    // First find the start and end of the trackClick function
    const trackClickStart = indexContent.indexOf('async function trackClick');
    if (trackClickStart === -1) {
      throw new Error('Could not find trackClick function in index.js');
    }
    
    // Find the end of the function (assuming it ends with a closing brace followed by newline)
    let trackClickEnd = trackClickStart;
    let braceCount = 0;
    let foundStart = false;
    
    for (let i = trackClickStart; i < indexContent.length; i++) {
      const char = indexContent[i];
      
      if (char === '{') {
        foundStart = true;
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (foundStart && braceCount === 0) {
          trackClickEnd = i + 1;
          break;
        }
      }
    }
    
    if (trackClickEnd === trackClickStart) {
      throw new Error('Could not find end of trackClick function');
    }
    
    // Read the new trackClick function from rtdb-patch.js
    const patchPath = path.join(__dirname, 'rtdb-patch.js');
    let patchContent;
    
    try {
      patchContent = fs.readFileSync(patchPath, 'utf8');
    } catch (err) {
      console.log('rtdb-patch.js not found, creating it...');
      
      // Create the patch file with the content
      const patchContent = `// === REALTIME DATABASE PATCH ===
// This file contains code that you can copy and paste into the Firebase Functions editor in the Firebase Console

// Add after admin.initializeApp()
// Initialize Realtime Database for click tracking
const clicksRef = admin.database().ref('clicks');
console.log('Initialized Realtime Database for clicks');

// Replace the trackClick function with this one
async function trackClick(shortCode, decodedUrl, userAgent, referrer, ip, cfCountry) {
  try {
    console.log(\`Starting click tracking for shortcode: \${shortCode}, target: \${decodedUrl}\`);
    
    // Ensure shortCode is valid before proceeding
    if (!shortCode) {
      console.error('Invalid shortCode provided to trackClick');
      return { success: false, error: 'Invalid shortCode' };
    }
    
    const timestamp = new Date();
    const day = timestamp.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    // Generate a unique ID for this click
    const clickId = crypto.randomBytes(16).toString('hex');
    
    // Use country from Cloudflare if available, otherwise 'Unknown'
    let country = cfCountry || 'Unknown';
    console.log(\`Country for click: \${country}, IP: \${ip}\`);
    
    // Create the click data
    const clickData = {
      type: 'click',
      shortCode,
      targetUrl: decodedUrl,
      userAgent: userAgent || null,
      referrer: referrer || null,
      ip: ip || null,
      country,
      timestamp: timestamp.toISOString(),
      day,
      processed: true
    };
    
    // First try to write to Realtime Database
    let rtdbSuccess = false;
    
    try {
      console.log('Attempting to write click to Realtime Database');
      // Check if RTDB is accessible with a quick test
      try {
        await clicksRef.child('_test_').set({ 
          timestamp: timestamp.toISOString(),
          test: true
        });
        console.log('✅ RTDB connection test passed');
        
        // Now try to write the click
        await clicksRef.child(clickId).set(clickData);
        
        rtdbSuccess = true;
        console.log(\`Click successfully stored in RTDB with ID \${clickId}\`);
        
        // Also update summary for this shortCode
        try {
          const summaryRef = clicksRef.child(\`summary_\${shortCode}\`);
          // Get current total clicks
          const summarySnapshot = await summaryRef.once('value');
          const summaryData = summarySnapshot.val() || { totalClicks: 0 };
          
          // Update summary
          await summaryRef.update({
            shortCode,
            targetUrl: decodedUrl,
            totalClicks: (summaryData.totalClicks || 0) + 1,
            lastClickAt: timestamp.toISOString()
          });
          console.log(\`Updated summary for \${shortCode}\`);
        } catch (summaryError) {
          console.error('Error updating summary:', summaryError.message);
        }
      } catch (testError) {
        console.error('RTDB connection test failed:', testError.message);
        // Continue to in-memory storage
      }
    } catch (rtdbError) {
      console.error('Error writing to RTDB:', rtdbError.message);
      // Continue to in-memory storage
    }
    
    // If RTDB failed, store in memory
    if (!rtdbSuccess) {
      console.log('Storing click in memory as fallback');
      
      if (!global.inMemoryClicks) {
        global.inMemoryClicks = [];
      }
      
      // Store the click in memory
      global.inMemoryClicks.push({
        id: clickId,
        ...clickData
      });
      
      console.log(\`Click stored in memory. Total in-memory clicks: \${global.inMemoryClicks.length}\`);
    }
    
    // Return success regardless of storage method
    return { 
      success: true, 
      clickId,
      rtdbSuccess,
      inMemory: !rtdbSuccess,
      inMemoryClicksCount: global.inMemoryClicks ? global.inMemoryClicks.length : 0
    };
  } catch (error) {
    console.error('Unhandled error in trackClick:', error);
    
    // Last resort: still try to store in memory even if another error occurred
    try {
      if (!global.inMemoryClicks) global.inMemoryClicks = [];
      
      global.inMemoryClicks.push({
        id: crypto.randomBytes(8).toString('hex'),
        shortCode,
        targetUrl: decodedUrl,
        country: cfCountry || 'Unknown',
        timestamp: new Date().toISOString(),
        day: new Date().toISOString().split('T')[0],
        error: error.message,
        emergency: true
      });
      
      console.log(\`Click stored in memory as emergency fallback. Total: \${global.inMemoryClicks.length}\`);
      
      return { 
        success: true, 
        emergency: true,
        inMemory: true,
        inMemoryClicksCount: global.inMemoryClicks.length
      };
    } catch (emergencyError) {
      console.error('Even emergency in-memory tracking failed:', emergencyError);
    }
    
    return { success: false, error: error.message };
  }
}`;
      
      fs.writeFileSync(patchPath, patchContent);
      patchContent = fs.readFileSync(patchPath, 'utf8');
    }
    
    // Extract just the trackClick function
    const trackClickFunctionMatch = patchContent.match(/async function trackClick[\s\S]+?^}/m);
    if (!trackClickFunctionMatch) {
      throw new Error('Could not find trackClick function in rtdb-patch.js');
    }
    
    const newTrackClickFunction = trackClickFunctionMatch[0];
    
    // Replace the old function with the new one
    indexContent = 
      indexContent.substring(0, trackClickStart) + 
      newTrackClickFunction + 
      indexContent.substring(trackClickEnd);
    
    // Add diagnostic endpoint before exports.api
    const apiExportIndex = indexContent.indexOf('exports.api =');
    if (apiExportIndex !== -1) {
      const diagnosticEndpoint = `
// Add a diagnostic endpoint 
app.get('/api/diagnose-rtdb', async (req, res) => {
  try {
    console.log('Starting RTDB diagnostic check');
    const diagnosticId = 'diag-' + Date.now().toString();
    const timestamp = new Date().toISOString();
    const db = admin.database();
    
    // Test database connection
    const testResult = {
      timestamp,
      diagnosticId
    };
    
    try {
      // Test if we can write to the database
      const diagRef = db.ref('diagnostics');
      await diagRef.child(diagnosticId).set({
        timestamp,
        test: 'RTDB connection test'
      });
      testResult.dbWriteSuccess = true;
      
      // Test if clicks reference exists
      testResult.clicksRefExists = !!clicksRef;
      
      // Get RTDB connection info
      const projectId = process.env.GCLOUD_PROJECT || admin.app().options.projectId;
      const databaseURL = admin.app().options.databaseURL;
      testResult.projectInfo = { projectId, databaseURL };
      
      // Check for in-memory clicks
      testResult.memoryClicksCount = global.inMemoryClicks ? global.inMemoryClicks.length : 0;
      
      res.json({
        status: 'success',
        message: 'RTDB is working correctly',
        ...testResult
      });
    } catch (error) {
      console.error('RTDB diagnostic error:', error);
      res.json({
        status: 'error',
        message: 'RTDB test failed',
        error: error.message,
        stack: error.stack,
        ...testResult
      });
    }
  } catch (error) {
    console.error('Unhandled error in RTDB diagnostic:', error);
    res.status(500).json({
      error: 'Unhandled error in RTDB diagnostic',
      message: error.message,
      stack: error.stack
    });
  }
});

`;
      indexContent = 
        indexContent.substring(0, apiExportIndex) + 
        diagnosticEndpoint +
        indexContent.substring(apiExportIndex);
    }
    
    // Also update the /api/click-stats endpoint to use RTDB
    // This is more complex and would require a regex replace or manual edit
    // For now, we'll just add support for the diagnostic endpoint
    
    // Write the updated index.js
    console.log('Writing updated index.js...');
    fs.writeFileSync(indexPath, indexContent);
    console.log('✅ index.js updated successfully.');
    
    // Create a backup for safety
    fs.copyFileSync(indexPath, indexPath + '.bak');
    console.log('✅ Created backup at index.js.bak');
  }
  
  // Deploy the updated functions
  console.log('\n2. Deploying updated functions...');
  try {
    // Try to deploy without auth first
    console.log('Attempting to deploy using npx firebase-tools...');
    execSync('npx firebase-tools deploy --only functions', { 
      stdio: 'inherit',
      cwd: __dirname
    });
    console.log('✅ Deployment completed successfully!');
  } catch (deployError) {
    console.error('Deployment failed. This is likely due to authentication issues.');
    console.log('\nTo manually deploy, please run:');
    console.log('cd functions && npx firebase login && npx firebase deploy --only functions');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error);
  process.exit(1);
} 