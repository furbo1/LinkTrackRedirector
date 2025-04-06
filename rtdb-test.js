// Script to test Realtime Database connectivity
const admin = require('firebase-admin');

console.log('=== RTDB CONNECTION TEST ===');

// Initialize with service account and explicit project ID
console.log('Initializing Firebase Admin SDK...');
try {
  admin.initializeApp({
    projectId: 'dlzz-pro-b1c80',
    databaseURL: 'https://dlzz-pro-b1c80-default-rtdb.firebaseio.com',
    credential: admin.credential.applicationDefault()
  });
  console.log('✅ Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
  process.exit(1);
}

// Get Realtime Database instance
const db = admin.database();
const clicksRef = db.ref('clicks');

// Function to write test data
async function testRTDBWrite() {
  try {
    console.log('Attempting to write test data to RTDB...');
    
    const clickData = {
      type: 'click',
      shortCode: 'test123',
      targetUrl: 'https://example.com/test',
      userAgent: 'Test Script',
      referrer: 'test-script',
      ip: '127.0.0.1',
      country: 'TEST',
      timestamp: new Date().toISOString(),
      day: new Date().toISOString().split('T')[0],
      testRecord: true
    };
    
    // Log what we're trying to write
    console.log('Click data to write:', JSON.stringify(clickData, null, 2));
    
    // Write to RTDB
    const clickId = Date.now().toString();
    console.log(`Writing to clicks/${clickId}`);
    await clicksRef.child(clickId).set(clickData);
    console.log('✅ Data written successfully!');
    
    // Read back the data to verify
    console.log('Reading back the data...');
    const snapshot = await clicksRef.child(clickId).once('value');
    const data = snapshot.val();
    
    if (data) {
      console.log('✅ Data read successfully!');
      console.log('Data read:', JSON.stringify(data, null, 2));
      
      // Clean up
      console.log('Cleaning up test data...');
      await clicksRef.child(clickId).remove();
      console.log('✅ Test data removed');
      
      return true;
    } else {
      console.error('❌ Data not found after writing!');
      return false;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

// List existing data
async function listExistingData() {
  try {
    console.log('\nListing existing data in RTDB clicks node...');
    const snapshot = await clicksRef.limitToLast(5).once('value');
    
    if (!snapshot.exists()) {
      console.log('No existing data found in clicks node');
    } else {
      console.log('Found existing data:');
      snapshot.forEach(childSnapshot => {
        console.log(`- Key: ${childSnapshot.key}`);
        console.log(`  Data: ${JSON.stringify(childSnapshot.val())}`);
      });
    }
    return true;
  } catch (error) {
    console.error('Failed to list existing data:', error.message);
    return false;
  }
}

// Main function
async function main() {
  // First try to list existing data
  await listExistingData();
  
  // Try to write test data
  const writeSuccess = await testRTDBWrite();
  
  console.log('\n=== TEST SUMMARY ===');
  console.log('RTDB write test:', writeSuccess ? '✅ PASSED' : '❌ FAILED');
  
  process.exit(writeSuccess ? 0 : 1);
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 