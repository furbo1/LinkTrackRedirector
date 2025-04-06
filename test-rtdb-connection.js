const axios = require('axios');

// Function to test our API endpoint with a new short URL 
async function testShortUrlCreation() {
  try {
    console.log('Creating a new short URL to test RTDB integration...');
    
    const response = await axios.post('https://dlzz-pro.web.app/api/shorten', {
      url: 'https://example.com/rtdb-test-' + Date.now()
    });
    
    console.log('Response:', response.data);
    
    if (response.data && response.data.shortUrl) {
      console.log('✅ Short URL created successfully:', response.data.shortUrl);
      
      // Now test the redirect by clicking the link
      console.log('\nTesting click tracking...');
      console.log('Please visit this URL to test click tracking:', response.data.shortUrl);
      
      // Wait a moment and then check stats
      console.log('\nWaiting 5 seconds before checking stats...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Get stats
      console.log('\nChecking click statistics...');
      const statsResponse = await axios.get('https://dlzz-pro.web.app/api/click-stats');
      
      if (statsResponse.data && statsResponse.data.meta) {
        console.log('Stats metadata:', statsResponse.data.meta);
        
        if (statsResponse.data.stats && statsResponse.data.stats.length > 0) {
          console.log(`Found ${statsResponse.data.stats.length} statistics entries`);
          
          // Look for our test entry
          const testEntry = statsResponse.data.stats.find(
            stat => stat.shortCode === response.data.shortCode
          );
          
          if (testEntry) {
            console.log('Found our test entry:', testEntry);
            console.log('Data source:', testEntry.source);
            console.log('Total clicks:', testEntry.totalClicks);
            
            if (testEntry.source && testEntry.source.includes('rtdb')) {
              console.log('✅ SUCCESS: Realtime Database integration is working!');
            } else if (testEntry.source === 'memory') {
              console.log('⚠️ PARTIAL SUCCESS: Tracking works but using in-memory fallback');
              console.log('Realtime Database might not be properly configured.');
            } else {
              console.log('ℹ️ Data is coming from:', testEntry.source);
            }
          } else {
            console.log('❌ Test entry not found in stats. Try visiting the link again.');
          }
        } else {
          console.log('❌ No statistics found. Try visiting the link again.');
        }
      } else {
        console.log('❌ Invalid statistics response:', statsResponse.data);
      }
      
      return response.data.shortUrl;
    } else {
      console.log('❌ Failed to create short URL:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return null;
  }
}

// Run the test
testShortUrlCreation()
  .then(url => {
    if (url) {
      console.log('\n=== TEST SUMMARY ===');
      console.log('Created URL:', url);
      console.log('Please visit this URL again and check the stats endpoint to confirm tracking is working.');
    } else {
      console.log('\n=== TEST FAILED ===');
    }
  })
  .catch(err => {
    console.error('Unhandled error:', err);
  }); 