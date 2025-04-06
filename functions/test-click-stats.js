const admin = require('firebase-admin');

// Initialize Firebase Admin SDK with application default credentials
admin.initializeApp({
  projectId: 'dlzz-pro-b1c80'
});

// Get a Firestore reference
const db = admin.firestore();
const clicksCollection = db.collection('clicks');
const urlMappingsCollection = db.collection('urlMappings');

// Function to process stat data (copied from your original code)
function processStatData(data, stats) {
  if (!data.shortCode) return;
  
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
    lastClickAt: data.lastClickAt ? data.lastClickAt.toDate() : null,
    avgClicksPerDay: Number(avgClicksPerDay),
    countryData,
    dailyClickData
  });
}

// Function to get click statistics
async function getClickStats() {
  try {
    console.log('Getting click statistics - test version');
    
    // Get summary documents
    let stats = [];
    
    try {
      console.log('Fetching documents from clicks collection');
      
      // First, log what's in the collection
      const allClicks = await clicksCollection.get();
      console.log(`TOTAL DOCUMENTS IN COLLECTION: ${allClicks.size}`);
      allClicks.forEach(doc => {
        console.log(`Document ID: ${doc.id}, Type: ${doc.data().type || 'unknown'}`);
      });
      
      // Check if the collection is accessible
      console.log('Collection access test succeeded');
      
      // First, try to get summary documents
      console.log('Fetching summary documents');
      const summarySnapshot = await clicksCollection.where('type', '==', 'summary').get();
      console.log(`Found ${summarySnapshot.size} summary documents`);
      
      if (!summarySnapshot.empty) {
        summarySnapshot.forEach(doc => {
          const data = doc.data();
          console.log(`Processing summary doc ${doc.id}:`, JSON.stringify(data));
          processStatData(data, stats);
        });
        console.log(`Processed ${stats.length} summary documents into stats`);
      }
      
      // If no summary docs found, fetch individual click documents
      if (stats.length === 0) {
        console.log('No summary documents found, fetching individual click documents');
        
        const clickSnapshot = await clicksCollection.where('type', '==', 'click').get();
        console.log(`Found ${clickSnapshot.size} individual click documents`);
        
        if (clickSnapshot.empty && stats.length === 0) {
          // If still no data, fall back to URL mappings
          console.log('No click documents found, falling back to URL mappings');
          const mappingsSnapshot = await urlMappingsCollection.get();
          console.log(`Found ${mappingsSnapshot.size} URL mappings`);
          
          mappingsSnapshot.forEach(doc => {
            const shortCode = doc.id;
            const url = doc.data().url;
            console.log(`URL mapping: ${shortCode} -> ${url}`);
            
            if (shortCode && url) {
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
            }
          });
        } else {
          // Group clicks by shortCode
          const clicksByShortCode = {};
          
          clickSnapshot.forEach(doc => {
            const clickData = doc.data();
            if (!clickData.shortCode) {
              console.log(`Click document ${doc.id} missing shortCode, skipping`);
              return;
            }
            
            if (!clicksByShortCode[clickData.shortCode]) {
              clicksByShortCode[clickData.shortCode] = [];
            }
            
            clicksByShortCode[clickData.shortCode].push({
              timestamp: clickData.timestamp ? clickData.timestamp.toDate() : new Date(),
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
              try {
                const urlDoc = await urlMappingsCollection.doc(shortCode).get();
                if (urlDoc.exists) {
                  targetUrl = urlDoc.data().url;
                } else {
                  targetUrl = 'Unknown URL';
                }
              } catch (error) {
                console.error(`Error fetching URL mapping for ${shortCode}:`, error);
                targetUrl = 'Error fetching URL';
              }
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
        console.log(`- ${stat.shortCode}: ${stat.totalClicks} clicks, ${stat.targetUrl}`);
      });
      
      return stats;
    } catch (firestoreError) {
      console.error('Error accessing Firestore:', firestoreError);
      return [];
    }
  } catch (error) {
    console.error('Error fetching click stats:', error);
    return [];
  } finally {
    // Clean up Firebase connection
    admin.app().delete();
  }
}

// Run the test
getClickStats().then(() => {
  console.log('Test completed');
}); 