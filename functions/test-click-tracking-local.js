const crypto = require('crypto');

// Mock in-memory databases for testing
const mockClicksCollection = [];
const mockSummaryCollection = {};
const mockUrlMappings = {
  'test123': 'https://example.com',
  'abc123': 'https://google.com',
  'xyz456': 'https://twitter.com',
  'be8b09': 'https://twitter.com',
  '09f8b8': 'https://instagram.com',
  'b59c8f': 'https://reddit.com'
};

// Simulate server timestamp
function serverTimestamp() {
  return new Date();
}

// Mock function to track a click
async function trackClick(shortCode, decodedUrl, userAgent, referrer, ip, cfCountry) {
  try {
    console.log(`Starting click tracking for shortcode: ${shortCode}, target: ${decodedUrl}`);
    
    // Ensure shortCode is valid before proceeding
    if (!shortCode) {
      console.error('Invalid shortCode provided to trackClick');
      return { success: false, error: 'Invalid shortCode' };
    }
    
    const timestamp = serverTimestamp();
    const day = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    // Generate a unique ID for this click
    const clickId = crypto.randomBytes(16).toString('hex');
    
    // Use country from Cloudflare if available, otherwise 'Unknown'
    let country = cfCountry || 'Unknown';
    console.log(`Country for click: ${country}, IP: ${ip}`);
    
    // Create a click document with a clear type field to distinguish it from summaries
    console.log(`Creating click document with ID: ${clickId}`);
    try {
      const clickDoc = {
        id: clickId,
        type: 'click', // Add this field to clearly identify click documents
        shortCode,
        targetUrl: decodedUrl,
        userAgent: userAgent || null,
        referrer: referrer || null,
        ip: ip || null,
        country,
        timestamp,
        day,
        processed: true
      };
      
      mockClicksCollection.push(clickDoc);
      console.log(`Successfully saved click document with ID: ${clickId}`);
    } catch (docError) {
      console.error(`Error saving click document: ${docError}`);
      // If document creation fails, try a simpler approach with less data
      try {
        const simpleClickDoc = {
          id: clickId,
          type: 'click', // Still include the type
          shortCode,
          targetUrl: decodedUrl,
          country: 'Unknown',
          timestamp,
          day
        };
        
        mockClicksCollection.push(simpleClickDoc);
        console.log(`Saved simplified click document with ID: ${clickId}`);
      } catch (simpleDocError) {
        console.error(`Error saving simplified click document: ${simpleDocError}`);
        return { success: false, error: simpleDocError.message };
      }
    }
    
    // Also update the count in a summary document for faster analytics
    console.log(`Updating summary document for shortcode: ${shortCode}`);
    const summaryId = `summary_${shortCode}`;
    
    try {
      // Check if summary already exists
      let summary = mockSummaryCollection[summaryId];
      
      if (!summary) {
        // Create new summary
        summary = {
          id: summaryId,
          type: 'summary',
          shortCode,
          targetUrl: decodedUrl,
          totalClicks: 0,
          lastClickAt: null
        };
      }
      
      // Update summary data
      summary.totalClicks += 1;
      summary.lastClickAt = timestamp;
      
      // Update day clicks
      const dayKey = `clicks_${day}`;
      summary[dayKey] = (summary[dayKey] || 0) + 1;
      
      // Update country clicks
      const countryKey = `country_${country}`;
      summary[countryKey] = (summary[countryKey] || 0) + 1;
      
      // Save updated summary
      mockSummaryCollection[summaryId] = summary;
      
      console.log(`Successfully updated summary document for ${shortCode}`);
    } catch (summaryError) {
      console.error(`Error updating summary document: ${summaryError}`);
      // If summary update fails, try a simpler approach
      try {
        let simpleSummary = mockSummaryCollection[summaryId] || {
          id: summaryId,
          type: 'summary',
          shortCode,
          targetUrl: decodedUrl,
          totalClicks: 0
        };
        
        simpleSummary.totalClicks += 1;
        simpleSummary.lastClickAt = timestamp;
        
        mockSummaryCollection[summaryId] = simpleSummary;
        console.log(`Updated simplified summary document for ${shortCode}`);
      } catch (simpleSummaryError) {
        console.error(`Error updating simplified summary document: ${simpleSummaryError}`);
      }
    }
    
    console.log(`Click successfully tracked for ${shortCode}, country: ${country}`);
    return { success: true, clickId };
  } catch (error) {
    console.error('Error tracking click:', error);
    return { success: false, error: error.message };
  }
}

// Function to get click statistics
async function getClickStats() {
  try {
    console.log('Getting click statistics - local test version');
    
    let stats = [];
    
    // First check if we have any summary documents
    console.log('Checking for summary documents...');
    const summaryDocs = Object.values(mockSummaryCollection);
    console.log(`Found ${summaryDocs.length} summary documents`);
    
    if (summaryDocs.length > 0) {
      summaryDocs.forEach(data => {
        console.log(`Processing summary doc ${data.id}:`, JSON.stringify(data));
        
        // Calculate daily average
        let totalDailyClicks = 0;
        let daysWithClicks = 0;
        let dailyClickData = {};
        
        // Look for daily click data (fields starting with "clicks_")
        Object.keys(data).forEach(key => {
          if (key.startsWith('clicks_')) {
            const day = key.replace('clicks_', '');
            const clicks = data[key];
            
            dailyClickData[day] = clicks;
            totalDailyClicks += clicks;
            daysWithClicks++;
          }
        });
        
        const avgClicksPerDay = daysWithClicks > 0
          ? (totalDailyClicks / daysWithClicks).toFixed(1)
          : 0;
        
        // Extract country data
        const countryData = {};
        Object.keys(data).forEach(key => {
          if (key.startsWith('country_')) {
            const country = key.replace('country_', '');
            countryData[country] = data[key];
          }
        });
        
        stats.push({
          shortCode: data.shortCode,
          targetUrl: data.targetUrl,
          totalClicks: data.totalClicks || 0,
          lastClickAt: data.lastClickAt,
          avgClicksPerDay: Number(avgClicksPerDay),
          countryData,
          dailyClickData
        });
      });
      
      console.log(`Processed ${stats.length} summary documents into stats`);
    }
    
    // If no summary documents found, process individual click documents
    if (stats.length === 0) {
      console.log('No summary documents found, processing individual click documents');
      
      const clickDocs = mockClicksCollection.filter(doc => doc.type === 'click');
      console.log(`Found ${clickDocs.length} individual click documents`);
      
      if (clickDocs.length === 0) {
        // If no clicks either, fall back to URL mappings
        console.log('No click documents found, falling back to URL mappings');
        
        Object.entries(mockUrlMappings).forEach(([shortCode, url]) => {
          console.log(`URL mapping: ${shortCode} -> ${url}`);
          
          stats.push({
            shortCode,
            targetUrl: url,
            totalClicks: 0,
            lastClickAt: null,
            avgClicksPerDay: 0,
            countryData: {},
            dailyClickData: {},
            recentClicks: []
          });
        });
      } else {
        // Group clicks by shortCode
        const clicksByShortCode = {};
        
        clickDocs.forEach(clickData => {
          if (!clickData.shortCode) {
            console.log(`Click document ${clickData.id} missing shortCode, skipping`);
            return;
          }
          
          if (!clicksByShortCode[clickData.shortCode]) {
            clicksByShortCode[clickData.shortCode] = [];
          }
          
          clicksByShortCode[clickData.shortCode].push({
            timestamp: clickData.timestamp,
            targetUrl: clickData.targetUrl,
            userAgent: clickData.userAgent || '',
            referrer: clickData.referrer || '',
            country: clickData.country || 'Unknown',
            day: clickData.day || new Date().toISOString().split('T')[0]
          });
        });
        
        console.log(`Grouped clicks by shortCode, found ${Object.keys(clicksByShortCode).length} unique shortcodes`);
        
        // Generate stats from grouped clicks
        for (const [shortCode, clicks] of Object.entries(clicksByShortCode)) {
          console.log(`Processing ${clicks.length} clicks for shortCode ${shortCode}`);
          
          // Get the target URL from clicks or mapping
          let targetUrl = clicks.length > 0 && clicks[0].targetUrl 
            ? clicks[0].targetUrl 
            : null;
            
          if (!targetUrl) {
            targetUrl = mockUrlMappings[shortCode] || 'Unknown URL';
          }
          
          console.log(`Target URL for ${shortCode}: ${targetUrl}`);
          
          // Count clicks by day and country
          const dayClicks = {};
          const countryClicks = {};
          
          clicks.forEach(click => {
            // Count by day
            const day = click.day || new Date().toISOString().split('T')[0]; // Fallback to today
            dayClicks[day] = (dayClicks[day] || 0) + 1;
            
            // Count by country
            const country = click.country || 'Unknown';
            countryClicks[country] = (countryClicks[country] || 0) + 1;
          });
          
          // Sort clicks by timestamp (newest first)
          clicks.sort((a, b) => {
            return new Date(b.timestamp) - new Date(a.timestamp);
          });
          
          // Create a stat record
          stats.push({
            shortCode,
            targetUrl,
            totalClicks: clicks.length,
            lastClickAt: clicks.length > 0 ? clicks[0].timestamp : null,
            avgClicksPerDay: Object.keys(dayClicks).length > 0 
              ? clicks.length / Object.keys(dayClicks).length 
              : clicks.length,
            countryData: countryClicks,
            dailyClickData: dayClicks,
            recentClicks: clicks.slice(0, 5) // Limit to last 5 clicks for logging
          });
        }
      }
    }
    
    // Sort by total clicks (descending)
    stats.sort((a, b) => b.totalClicks - a.totalClicks);
    
    console.log(`Final stats (${stats.length} entries):`);
    stats.forEach(stat => {
      console.log(`- ${stat.shortCode}: ${stat.totalClicks} clicks, URL: ${stat.targetUrl}`);
    });
    
    return stats;
  } catch (error) {
    console.error('Error fetching click stats:', error);
    return [];
  }
}

// Function to test the full flow
async function testFlow() {
  console.log('=== TESTING LOCAL CLICK TRACKING FLOW ===');
  
  // Track clicks for multiple URLs to simulate real usage
  const urls = [
    { shortCode: 'test123', url: 'https://example.com', userAgent: 'Chrome', country: 'US' },
    { shortCode: 'abc123', url: 'https://google.com', userAgent: 'Firefox', country: 'UK' },
    { shortCode: 'xyz456', url: 'https://twitter.com', userAgent: 'Safari', country: 'CA' },
    { shortCode: 'be8b09', url: 'https://twitter.com', userAgent: 'Chrome Mobile', country: 'FR' },
    { shortCode: '09f8b8', url: 'https://instagram.com', userAgent: 'Safari', country: 'JP' }
  ];
  
  // Create multiple clicks (some for the same URLs)
  for (const urlData of urls) {
    console.log(`\n=== TRACKING CLICK FOR ${urlData.shortCode} ===`);
    await trackClick(
      urlData.shortCode,
      urlData.url,
      urlData.userAgent,
      'https://referrer.com',
      '192.168.1.1',
      urlData.country
    );
  }
  
  // Add a second click for one of the URLs
  console.log(`\n=== TRACKING SECOND CLICK FOR test123 ===`);
  await trackClick(
    'test123',
    'https://example.com',
    'Edge',
    'https://differentreferrer.com',
    '192.168.1.2',
    'DE'
  );
  
  // Now get the click stats
  console.log('\n=== GETTING CLICK STATISTICS ===');
  const stats = await getClickStats();
  
  console.log('\n=== STATS RETRIEVAL RESULT ===');
  console.log(`Retrieved ${stats.length} stat entries`);
  
  // Check if all URLs are in the stats
  console.log('\n=== VERIFICATION ===');
  const foundCodes = stats.map(s => s.shortCode);
  const expectedCodes = urls.map(u => u.shortCode);
  
  expectedCodes.forEach(code => {
    if (foundCodes.includes(code)) {
      console.log(`✅ Found stats for ${code}`);
    } else {
      console.log(`❌ Missing stats for ${code}`);
    }
  });
  
  // Verify click counts
  const test123Stats = stats.find(s => s.shortCode === 'test123');
  if (test123Stats && test123Stats.totalClicks === 2) {
    console.log('✅ Correct click count (2) for test123');
  } else {
    console.log(`❌ Incorrect click count for test123: ${test123Stats?.totalClicks || 'missing'}`);
  }
  
  console.log('\n=== TEST COMPLETED ===');
}

// Run the test
testFlow(); 