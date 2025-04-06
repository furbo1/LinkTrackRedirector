// Script to test writing to the clicks collection
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

console.log('=== CLICK TRACKING TEST ===');

// Initialize with service account and explicit project ID
console.log('Initializing Firebase Admin SDK...');
try {
  admin.initializeApp({
    projectId: 'dlzz-pro-b1c80',
    credential: admin.credential.applicationDefault()
  });
  console.log('✅ Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
  process.exit(1);
}

// Get Firestore instance
const db = admin.firestore();
const clicksCollection = db.collection('clicks');

// Test function to write a click
async function testClickWrite() {
  try {
    console.log('Attempting to write test click to Firestore...');
    
    // Generate a unique ID for this click
    const clickId = uuidv4();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const day = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    // Create test click data
    const clickData = {
      type: 'click',
      shortCode: 'test123',
      targetUrl: 'https://example.com/test',
      userAgent: 'Test Script',
      referrer: 'test-script',
      ip: '127.0.0.1',
      country: 'TEST',
      timestamp,
      day,
      testRecord: true
    };
    
    // Log what we're trying to write
    console.log('Click data to write:', JSON.stringify(clickData, null, 2));
    
    // Write to Firestore
    console.log(`Writing to clicks collection with ID: ${clickId}`);
    const docRef = clicksCollection.doc(clickId);
    await docRef.set(clickData);
    
    // Verify the document exists
    console.log('Verifying click document was created...');
    const docSnapshot = await docRef.get();
    
    if (docSnapshot.exists) {
      console.log('✅ Click document created successfully!');
      console.log('Document data:', docSnapshot.data());
      
      // Clean up
      console.log('Cleaning up test document...');
      await docRef.delete();
      console.log('✅ Test document deleted');
      
      return true;
    } else {
      console.error('❌ Document not found after writing!');
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to write click:', error);
    console.error('Error code:', error.code);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    // Try to get more info
    if (error.message.includes('Permission denied')) {
      console.error('⚠️ Permission denied issue detected - check service account permissions');
    } else if (error.message.includes('DEADLINE_EXCEEDED')) {
      console.error('⚠️ Timeout detected - check network connectivity to Firestore');
    } else if (error.message.includes('UNAVAILABLE')) {
      console.error('⚠️ Service unavailable - check if Firestore is enabled for this project');
    }
    
    return false;
  }
}

// Test function to list existing clicks
async function listExistingClicks() {
  try {
    console.log('\nListing existing clicks in collection...');
    const snapshot = await clicksCollection.limit(5).get();
    
    if (snapshot.empty) {
      console.log('No existing documents found in clicks collection');
    } else {
      console.log(`Found ${snapshot.size} documents:`);
      snapshot.forEach(doc => {
        console.log(`- Document ID: ${doc.id}`);
        const data = doc.data();
        // Print a few key fields from each document
        console.log(`  ShortCode: ${data.shortCode}, URL: ${data.targetUrl?.substring(0, 30)}...`);
      });
    }
    return true;
  } catch (error) {
    console.error('Failed to list clicks:', error);
    return false;
  }
}

async function main() {
  // First try to list existing clicks to check read access
  await listExistingClicks();
  
  // Try to write a test click
  const writeSuccess = await testClickWrite();
  
  console.log('\n=== TEST SUMMARY ===');
  console.log('Click write test:', writeSuccess ? '✅ PASSED' : '❌ FAILED');
  
  console.log('\n=== ENVIRONMENT INFO ===');
  console.log('Node version:', process.version);
  console.log('Service account credentials file:', process.env.GOOGLE_APPLICATION_CREDENTIALS || 'Not set');
  
  process.exit(writeSuccess ? 0 : 1);
}

// Run tests
main().catch(error => {
  console.error('Unhandled error in test script:', error);
  process.exit(1);
}); 