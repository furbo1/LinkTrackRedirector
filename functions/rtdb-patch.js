// === REALTIME DATABASE PATCH ===
// This file contains code that you can copy and paste into the Firebase Functions editor in the Firebase Console

// Add after admin.initializeApp()
// Initialize Realtime Database for click tracking
const clicksRef = admin.database().ref('clicks');
console.log('Initialized Realtime Database for clicks');

// Replace the trackClick function with this one
async function trackClick(shortCode, decodedUrl, userAgent, referrer, ip, cfCountry) {
  try {
    console.log(`Starting click tracking for shortcode: ${shortCode}, target: ${decodedUrl}`);
    
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
    console.log(`Country for click: ${country}, IP: ${ip}`);
    
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
        console.log(`Click successfully stored in RTDB with ID ${clickId}`);
        
        // Also update summary for this shortCode
        try {
          const summaryRef = clicksRef.child(`summary_${shortCode}`);
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
          console.log(`Updated summary for ${shortCode}`);
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
      
      console.log(`Click stored in memory. Total in-memory clicks: ${global.inMemoryClicks.length}`);
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
      
      console.log(`Click stored in memory as emergency fallback. Total: ${global.inMemoryClicks.length}`);
      
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
}

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

// To update the click-stats endpoint, visit:
// https://github.com/alexcdalton/LinkTrackRedirector/blob/main/functions/rtdb-patch.js 