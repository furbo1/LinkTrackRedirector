// RTDB Diagnostic code to be added to your Cloud Functions

// Add this to your imports at the top of index.js
// const diagRtdb = require('./diagnose-rtdb');

// Add this to your Express app 
// app.get('/api/diagnose-rtdb', diagRtdb.diagnoseRtdbHandler);

// Handler for diagnosing RTDB connectivity
async function diagnoseRtdbHandler(req, res) {
  try {
    console.log('Starting RTDB diagnostic check');
    const diagnosticId = 'diag-' + Date.now().toString();
    const timestamp = new Date().toISOString();
    
    // Get reference to the RTDB
    const db = admin.database();
    const diagRef = db.ref('diagnostics');
    
    let rtdbInitialized = false;
    let rtdbConnectionTest = false;
    let rtdbWriteTest = false;
    let rtdbReadTest = false;
    let rtdbDeleteTest = false;
    let errorMessages = [];
    
    // Test 1: Check if RTDB is initialized
    try {
      console.log('Test 1: Checking if RTDB is initialized');
      if (db) {
        rtdbInitialized = true;
        console.log('✅ RTDB is initialized');
      } else {
        errorMessages.push('RTDB is not initialized');
        console.error('❌ RTDB is not initialized');
      }
    } catch (error) {
      errorMessages.push('Error checking RTDB initialization: ' + error.message);
      console.error('❌ Error checking RTDB initialization:', error);
    }
    
    // Only continue if RTDB is initialized
    if (rtdbInitialized) {
      // Test 2: Test connection
      try {
        console.log('Test 2: Testing RTDB connection');
        const connTestRef = diagRef.child('connection_test');
        await connTestRef.set({
          timestamp,
          test: 'connection'
        });
        rtdbConnectionTest = true;
        console.log('✅ RTDB connection test passed');
      } catch (error) {
        errorMessages.push('RTDB connection test failed: ' + error.message);
        console.error('❌ RTDB connection test failed:', error);
      }
      
      // Test 3: Write test
      try {
        console.log('Test 3: Testing RTDB write operation');
        const writeData = {
          id: diagnosticId,
          timestamp,
          test: 'write',
          message: 'This is a diagnostic test'
        };
        await diagRef.child(diagnosticId).set(writeData);
        rtdbWriteTest = true;
        console.log('✅ RTDB write test passed');
        
        // Test 4: Read test
        try {
          console.log('Test 4: Testing RTDB read operation');
          const snapshot = await diagRef.child(diagnosticId).once('value');
          const readData = snapshot.val();
          
          if (readData && readData.id === diagnosticId) {
            rtdbReadTest = true;
            console.log('✅ RTDB read test passed');
            console.log('Read data:', readData);
            
            // Test 5: Delete test
            try {
              console.log('Test 5: Testing RTDB delete operation');
              await diagRef.child(diagnosticId).remove();
              
              // Verify deletion
              const verifySnapshot = await diagRef.child(diagnosticId).once('value');
              if (!verifySnapshot.exists()) {
                rtdbDeleteTest = true;
                console.log('✅ RTDB delete test passed');
              } else {
                errorMessages.push('RTDB delete verification failed');
                console.error('❌ RTDB delete verification failed');
              }
            } catch (error) {
              errorMessages.push('RTDB delete test failed: ' + error.message);
              console.error('❌ RTDB delete test failed:', error);
            }
          } else {
            errorMessages.push('RTDB read test failed: Data mismatch or missing');
            console.error('❌ RTDB read test failed: Data mismatch or missing');
          }
        } catch (error) {
          errorMessages.push('RTDB read test failed: ' + error.message);
          console.error('❌ RTDB read test failed:', error);
        }
      } catch (error) {
        errorMessages.push('RTDB write test failed: ' + error.message);
        console.error('❌ RTDB write test failed:', error);
      }
    }
    
    // Gather Firebase project info
    const projectId = process.env.GCLOUD_PROJECT || admin.app().options.projectId;
    const databaseURL = admin.app().options.databaseURL;
    
    // Check RTDB references for clicks
    let clicksRefStatus = 'Not checked';
    try {
      if (global.clicksRef) {
        clicksRefStatus = 'Global clicksRef exists';
      } else {
        clicksRefStatus = 'Global clicksRef does not exist';
        
        // Try to create it now
        global.clicksRef = db.ref('clicks');
        clicksRefStatus += ' (created now)';
      }
    } catch (error) {
      clicksRefStatus = 'Error checking clicksRef: ' + error.message;
    }
    
    // Create diagnostic result
    const diagnosticResult = {
      timestamp,
      diagnosticId,
      tests: {
        rtdbInitialized,
        rtdbConnectionTest,
        rtdbWriteTest,
        rtdbReadTest,
        rtdbDeleteTest
      },
      projectInfo: {
        projectId,
        databaseURL
      },
      clicksRefStatus,
      errorMessages,
      allTestsPassed: rtdbInitialized && rtdbConnectionTest && rtdbWriteTest && rtdbReadTest && rtdbDeleteTest
    };
    
    // Save diagnostic result for future reference
    try {
      await diagRef.child('results').child(diagnosticId).set(diagnosticResult);
    } catch (error) {
      console.error('Error saving diagnostic result:', error);
    }
    
    // Return diagnostic result
    res.json(diagnosticResult);
  } catch (error) {
    console.error('Unhandled error in RTDB diagnostic:', error);
    res.status(500).json({
      error: 'Unhandled error in RTDB diagnostic',
      message: error.message,
      stack: error.stack
    });
  }
}

module.exports = {
  diagnoseRtdbHandler
}; 