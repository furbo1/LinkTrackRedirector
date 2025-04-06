const admin = require('firebase-admin');

// Initialize with application default credentials
console.log('Attempting to initialize Firebase Admin SDK');
try {
  admin.initializeApp();
  console.log('✅ Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
  process.exit(1);
}

// Try to access Firestore
console.log('\nAttempting to access Firestore');
const db = admin.firestore();

async function testFirestore() {
  try {
    // Try a simple operation
    console.log('Testing Firestore with a simple query...');
    const testCollection = db.collection('test-credentials');
    const snapshot = await testCollection.limit(1).get();
    console.log(`✅ Firestore query succeeded, returned ${snapshot.size} documents`);
    
    // Try to write a document
    console.log('\nTesting Firestore write...');
    const docRef = testCollection.doc('test-' + Date.now());
    await docRef.set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      message: 'Test connection'
    });
    console.log('✅ Successfully wrote test document to Firestore');
    
    // Verify the document exists
    console.log('\nVerifying document was created...');
    const docSnapshot = await docRef.get();
    if (docSnapshot.exists) {
      console.log('✅ Test document exists:', docSnapshot.data());
    } else {
      console.error('❌ Test document does not exist after writing!');
    }
    
    // Clean up
    console.log('\nCleaning up test document...');
    await docRef.delete();
    console.log('✅ Test document deleted');
    
    return true;
  } catch (error) {
    console.error('❌ Firestore test failed:', error);
    console.error('\nDIAGNOSTIC INFORMATION:');
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    console.error('Full error:', error);
    
    if (error.code === 'app/invalid-credential' || error.message.includes('credential')) {
      console.error('\n🔑 CREDENTIAL ISSUE DETECTED:');
      console.error('- Make sure you are logged in with Firebase CLI: firebase login');
      console.error('- Check if you need a service account key: https://firebase.google.com/docs/admin/setup#initialize-sdk');
      console.error('- Verify GOOGLE_APPLICATION_CREDENTIALS environment variable is set to your service account key');
    }
    
    return false;
  }
}

async function main() {
  console.log('=== FIREBASE CREDENTIALS DIAGNOSTIC ===\n');
  
  // Get project details
  try {
    const projectId = admin.app().options.projectId || 'unknown';
    console.log('Project ID:', projectId);
  } catch (error) {
    console.error('Could not determine project ID:', error.message);
  }
  
  const firestoreResult = await testFirestore();
  
  console.log('\n=== DIAGNOSTIC RESULTS ===');
  console.log('Firebase Admin SDK initialized:', '✅ Success');
  console.log('Firestore connection test:', firestoreResult ? '✅ Passed' : '❌ Failed');
  
  console.log('\n=== ENVIRONMENT ===');
  console.log('Node version:', process.version);
  console.log('Platform:', process.platform);
  
  // Get Firebase Admin version safely
  try {
    const firebaseAdminVersion = require('firebase-admin/package.json').version;
    console.log('Firebase Admin SDK version:', firebaseAdminVersion);
  } catch (e) {
    console.log('Firebase Admin SDK version: Could not determine');
  }
  
  // Check for credential environment variables
  console.log('\n=== CREDENTIALS ===');
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
  } else {
    console.log('GOOGLE_APPLICATION_CREDENTIALS: ❌ Not set');
    console.log('This environment variable is needed for service account authentication');
  }
  
  process.exit(firestoreResult ? 0 : 1);
}

main().catch(error => {
  console.error('Unhandled error during diagnostic:', error);
  process.exit(1);
}); 