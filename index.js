// Initialize click tracking collection in Firebase Realtime Database
const clicksRef = admin.database().ref('clicks');
console.log('Initialized Realtime Database for clicks');

// Replace the trackClick function with this improved version that uses RTDB
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
    
    // Log key parts of the tracking for debugging
    console.log('Creating click with data:', JSON.stringify({
      clickId,
      shortCode,
      decodedUrl,
      userAgent: userAgent ? userAgent.substring(0, 50) + '...' : null,
      ip: ip ? ip.substring(0, 15) + '...' : null,
      country,
      day
    }));
    
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

// Also update the /api/click-stats endpoint to use RTDB
app.get('/api/click-stats', async (req, res) => {
  try {
    console.log('API Request: Getting click statistics');
    
    // Initialize stats array
    let stats = [];
    let rtdbAvailable = false;
    let rtdbError = null;
    
    // First try RTDB
    try {
      console.log('Checking if RTDB is available...');
      
      // Quick test to see if RTDB is accessible
      try {
        await clicksRef.child('_connection_test_').set({ 
          timestamp: new Date().toISOString(),
          test: true
        });
        rtdbAvailable = true;
        console.log('✅ RTDB connection test passed');
      } catch (testError) {
        console.error('RTDB connection test failed:', testError.message);
        rtdbError = testError.message;
      }
      
      // Only try to get stats from RTDB if available
      if (rtdbAvailable) {
        console.log('Fetching data from clicks in RTDB');
        
        // Try to get summary documents first
        const summarySnapshot = await clicksRef.orderByKey()
          .startAt('summary_')
          .endAt('summary_\uf8ff')
          .once('value');
        
        console.log(`Found ${Object.keys(summarySnapshot.val() || {}).length} summary documents`);
        
        if (summarySnapshot.exists()) {
          summarySnapshot.forEach(childSnapshot => {
            const data = childSnapshot.val();
            console.log(`Processing summary doc ${childSnapshot.key}`);
            
            if (!data.shortCode) return;
            
            stats.push({
              shortCode: data.shortCode,
              targetUrl: data.targetUrl,
              totalClicks: data.totalClicks || 0,
              lastClickAt: data.lastClickAt ? new Date(data.lastClickAt) : null,
              avgClicksPerDay: 0, // Will calculate later
              countryData: data.countryData || {},
              dailyClickData: data.dailyClickData || {},
              source: 'rtdb_summary'
            });
          });
          console.log(`Processed ${stats.length} summary documents into stats`);
        }
        
        // If no summary docs, fetch individual click documents
        if (stats.length === 0) {
          console.log('No summary documents found, fetching individual click documents');
          
          const clickSnapshot = await clicksRef.orderByChild('type')
            .equalTo('click')
            .limitToLast(1000)
            .once('value');
          
          if (clickSnapshot.exists()) {
            const clicks = [];
            clickSnapshot.forEach(childSnapshot => {
              clicks.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
              });
            });
            
            console.log(`Found ${clicks.length} individual click documents`);
            
            // Group clicks by shortCode
            const clicksByShortCode = {};
            
            clicks.forEach(click => {
              if (!click.shortCode) return;
              
              if (!clicksByShortCode[click.shortCode]) {
                clicksByShortCode[click.shortCode] = [];
              }
              
              clicksByShortCode[click.shortCode].push(click);
            });
            
            // Generate stats from grouped clicks
            for (const [shortCode, shortCodeClicks] of Object.entries(clicksByShortCode)) {
              // Get the target URL from clicks
              let targetUrl = shortCodeClicks.length > 0 && shortCodeClicks[0].targetUrl 
                ? shortCodeClicks[0].targetUrl 
                : null;
                
              if (!targetUrl) {
                // Try to get URL from mappings
                targetUrl = urlMappings[shortCode] || 'Unknown URL';
              }
              
              // Count clicks by day and country
              const dayClicks = {};
              const countryClicks = {};
              
              shortCodeClicks.forEach(click => {
                // Count by day
                const day = click.day;
                dayClicks[day] = (dayClicks[day] || 0) + 1;
                
                // Count by country
                const country = click.country || 'Unknown';
                countryClicks[country] = (countryClicks[country] || 0) + 1;
              });
              
              // Sort clicks by timestamp (newest first)
              shortCodeClicks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
              
              // Create a stat record
              stats.push({
                shortCode,
                targetUrl,
                totalClicks: shortCodeClicks.length,
                lastClickAt: shortCodeClicks.length > 0 ? new Date(shortCodeClicks[0].timestamp) : null,
                avgClicksPerDay: Object.keys(dayClicks).length > 0 
                  ? shortCodeClicks.length / Object.keys(dayClicks).length 
                  : shortCodeClicks.length,
                countryData: countryClicks,
                dailyClickData: dayClicks,
                recentClicks: shortCodeClicks.slice(0, 50), // Limit to last 50 clicks
                source: 'rtdb_clicks'
              });
            }
            
            console.log(`Generated ${stats.length} stats from individual click documents`);
          }
        }
      }
    } catch (error) {
      console.error('Error accessing RTDB:', error);
      rtdbError = error.message;
    }
    
    // Check for in-memory clicks if no RTDB data was found or RTDB is unavailable
    if ((stats.length === 0 || !rtdbAvailable) && global.inMemoryClicks && global.inMemoryClicks.length > 0) {
      console.log(`Processing ${global.inMemoryClicks.length} in-memory clicks`);
      
      // Group in-memory clicks by shortCode
      const clicksByShortCode = {};
      
      global.inMemoryClicks.forEach(click => {
        if (!clicksByShortCode[click.shortCode]) {
          clicksByShortCode[click.shortCode] = [];
        }
        
        clicksByShortCode[click.shortCode].push({
          timestamp: new Date(click.timestamp),
          targetUrl: click.targetUrl,
          country: click.country || 'Unknown',
          day: click.day,
          referrer: click.referrer,
          userAgent: click.userAgent
        });
      });
      
      // Generate stats from in-memory clicks
      for (const [shortCode, clicks] of Object.entries(clicksByShortCode)) {
        const targetUrl = clicks[0].targetUrl;
        
        // Count clicks by day and country
        const dayClicks = {};
        const countryClicks = {};
        
        clicks.forEach(click => {
          dayClicks[click.day] = (dayClicks[click.day] || 0) + 1;
          countryClicks[click.country] = (countryClicks[click.country] || 0) + 1;
        });
        
        // Sort clicks by timestamp (newest first)
        clicks.sort((a, b) => b.timestamp - a.timestamp);
        
        stats.push({
          shortCode,
          targetUrl,
          totalClicks: clicks.length,
          lastClickAt: clicks[0].timestamp,
          avgClicksPerDay: Object.keys(dayClicks).length > 0 
            ? clicks.length / Object.keys(dayClicks).length 
            : clicks.length,
          countryData: countryClicks,
          dailyClickData: dayClicks,
          recentClicks: clicks.slice(0, 50),
          source: 'memory' // Mark these as coming from memory
        });
      }
      
      console.log(`Added ${stats.length} stat entries from in-memory clicks`);
    }
    
    // Sort by total clicks (descending)
    stats.sort((a, b) => b.totalClicks - a.totalClicks);
    
    console.log(`Found ${stats.length} statistics entries in total`);
    
    // Enhance the response with diagnostic info
    const response = { 
      stats,
      meta: {
        totalStats: stats.length,
        rtdbAvailable,
        rtdbError,
        inMemoryStatsUsed: stats.some(s => s.source === 'memory'),
        memoryClicksAvailable: global.inMemoryClicks && global.inMemoryClicks.length > 0,
        memoryClicksCount: global.inMemoryClicks ? global.inMemoryClicks.length : 0,
        timestamp: new Date().toISOString()
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching click stats:', error);
    res.status(500).json({ 
      error: 'Error fetching click statistics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}); 