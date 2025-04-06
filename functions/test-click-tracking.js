const admin = require('firebase-admin');
const crypto = require('crypto');

// Initialize Firebase Admin SDK with your service account
// We'll use application default credentials since we're running locally
admin.initializeApp({
  projectId: 'dlzz-pro-b1c80'
});

// Get a Firestore reference
const db = admin.firestore();
const clicksCollection = db.collection('clicks');

// Test function to create a click document
async function createTestClick() {
  try {
    console.log('Starting test click creation...');
    
    // Generate a unique ID for this click
    const clickId = crypto.randomBytes(16).toString('hex');
    console.log(`Generated click ID: ${clickId}`);
    
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const day = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    // Create a test click document
    const shortCode = 'test123';
    const targetUrl = 'https://example.com';
    
    console.log(`Creating document with ID: ${clickId}`);
    console.log('Document data:', {
      type: 'click',
      shortCode,
      targetUrl,
      userAgent: 'Test Agent',
      referrer: 'Test Referrer',
      ip: '127.0.0.1',
      country: 'TestCountry',
      timestamp: 'serverTimestamp()',
      day,
      testClick: true
    });
    
    // Test 1: Create a click document with a specific ID
    await clicksCollection.doc(clickId).set({
      type: 'click',
      shortCode,
      targetUrl,
      userAgent: 'Test Agent',
      referrer: 'Test Referrer',
      ip: '127.0.0.1',
      country: 'TestCountry',
      timestamp,
      day,
      testClick: true
    });
    console.log(`Successfully created test click document with ID: ${clickId}`);
    
    // Verify document exists
    const docRef = await clicksCollection.doc(clickId).get();
    console.log(`Document exists: ${docRef.exists}`);
    if (docRef.exists) {
      console.log('Document data:', docRef.data());
    }
    
    // Test 2: Create a click document with auto-generated ID
    console.log('Creating document with auto-generated ID');
    const autoDocRef = await clicksCollection.add({
      type: 'click',
      shortCode: 'autotest',
      targetUrl: 'https://example.com/auto',
      userAgent: 'Auto Test Agent',
      timestamp,
      day,
      testClick: true
    });
    console.log(`Successfully created auto-ID document: ${autoDocRef.id}`);
    
    // Test 3: Update summary document
    console.log('Updating summary document');
    const summaryRef = clicksCollection.doc(`summary_${shortCode}`);
    await summaryRef.set({
      type: 'summary',
      shortCode,
      targetUrl,
      totalClicks: admin.firestore.FieldValue.increment(1),
      lastClickAt: timestamp,
      [`clicks_${day}`]: admin.firestore.FieldValue.increment(1),
      [`country_TestCountry`]: admin.firestore.FieldValue.increment(1)
    }, { merge: true });
    console.log('Summary document updated successfully');
    
    // Test 4: Read from the collection
    console.log('Reading all documents from clicks collection');
    const snapshot = await clicksCollection.get();
    console.log(`Total documents in collection: ${snapshot.size}`);
    snapshot.forEach(doc => {
      console.log(`Document ID: ${doc.id}`, doc.data());
    });
    
    console.log('All tests completed successfully');
  } catch (error) {
    console.error('Error in test:', error);
  } finally {
    // Clean up Firebase connection
    admin.app().delete();
  }
}

// Run the test
createTestClick(); 