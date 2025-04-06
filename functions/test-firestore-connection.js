const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

// Initialize Firebase Admin
try {
  admin.initializeApp({
    projectId: 'dlzz-pro-b1c80', // Specify the project ID
  });
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin:', error);
  process.exit(1);
}

// Get Firestore instance
const db = admin.firestore();
console.log('Firestore instance created');

// Test connection by writing and reading a document
async function testFirestoreConnection() {
  const testId = uuidv4();
  const testData = {
    id: testId,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    message: 'Test connection from diagnostic script'
  };

  try {
    console.log('Attempting to write test document to Firestore...');
    const docRef = db.collection('diagnostics').doc(testId);
    await docRef.set(testData);
    console.log('Successfully wrote test document to Firestore');

    console.log('Attempting to read test document from Firestore...');
    const docSnapshot = await docRef.get();
    
    if (docSnapshot.exists) {
      console.log('Successfully read test document from Firestore:', docSnapshot.data());
    } else {
      console.error('Test document does not exist after writing!');
    }

    // Test the click tracking by writing to clicks collection
    console.log('Testing click tracking collection...');
    const clickId = uuidv4();
    const clickData = {
      shortCode: 'test123',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: 'Diagnostic Script',
      referrer: 'diagnostic-test',
      ip: '127.0.0.1',
      country: 'TEST'
    };

    const clickDocRef = db.collection('clicks').doc(clickId);
    await clickDocRef.set(clickData);
    console.log('Successfully wrote test click to Firestore');

    // Clean up
    console.log('Cleaning up test documents...');
    await docRef.delete();
    await clickDocRef.delete();
    console.log('Test documents deleted');

    return true;
  } catch (error) {
    console.error('Error during Firestore connection test:', error);
    return false;
  }
}

// Test connection to clicks collection
async function testClicksCollection() {
  try {
    console.log('Testing access to clicks collection...');
    const clicksSnapshot = await db.collection('clicks').limit(5).get();
    console.log(`Found ${clicksSnapshot.size} documents in clicks collection`);
    
    clicksSnapshot.forEach(doc => {
      console.log('Click document:', doc.id, doc.data());
    });
    
    return true;
  } catch (error) {
    console.error('Error accessing clicks collection:', error);
    return false;
  }
}

// Main function
async function main() {
  console.log('=== FIRESTORE CONNECTION DIAGNOSTIC ===');
  
  // Test basic connection
  const connectionSuccess = await testFirestoreConnection();
  console.log('\nFirestore connection test:', connectionSuccess ? 'PASSED' : 'FAILED');
  
  // If basic connection works, test clicks collection
  if (connectionSuccess) {
    const clicksSuccess = await testClicksCollection();
    console.log('\nClicks collection test:', clicksSuccess ? 'PASSED' : 'FAILED');
  }
  
  console.log('\n=== DIAGNOSTIC COMPLETE ===');
  process.exit(connectionSuccess ? 0 : 1);
}

// Run the tests
main();