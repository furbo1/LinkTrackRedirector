// Diagnostic tool for click tracking in Firebase Functions
// This file provides a diagnostic endpoint to check click tracking status

// Add this to your index.js:
// const diagnosePage = require('./diagnosePage');
// app.get('/api/diagnose', diagnosePage.diagnoseHandler);

async function diagnoseHandler(req, res) {
  try {
    const admin = require('firebase-admin');
    const db = admin.firestore();
    const clicksCollection = db.collection('clicks');
    const urlMappingsCollection = db.collection('urlMappings');

    const results = {
      timestamp: new Date().toISOString(),
      databaseInfo: {},
      documentsFound: {
        clicks: {
          total: 0,
          byType: {},
          samples: []
        },
        urlMappings: {
          total: 0,
          samples: []
        }
      },
      connectionStatus: "success",
      testResults: {},
      errorLog: []
    };

    // Check for url mappings
    try {
      const urlMappingsSnapshot = await urlMappingsCollection.get();
      results.documentsFound.urlMappings.total = urlMappingsSnapshot.size;
      
      let count = 0;
      urlMappingsSnapshot.forEach(doc => {
        if (count < 5) { // Only show up to 5 samples
          results.documentsFound.urlMappings.samples.push({
            id: doc.id,
            data: doc.data()
          });
        }
        count++;
      });
    } catch (error) {
      results.errorLog.push({
        operation: "urlMappings.get",
        error: error.message,
        stack: error.stack
      });
    }

    // Check for ALL documents in clicks collection
    try {
      const allClicksSnapshot = await clicksCollection.get();
      results.documentsFound.clicks.total = allClicksSnapshot.size;
      
      // Count by type
      let clickCount = 0;
      let summaryCount = 0;
      let unknownCount = 0;
      let count = 0;
      
      allClicksSnapshot.forEach(doc => {
        const data = doc.data();
        const type = data.type || 'unknown';
        
        // Increment type counter
        if (type === 'click') clickCount++;
        else if (type === 'summary') summaryCount++;
        else unknownCount++;
        
        // Add sample documents
        if (count < 10) { // Only show up to 10 samples
          results.documentsFound.clicks.samples.push({
            id: doc.id,
            type: type,
            data: data
          });
        }
        count++;
      });
      
      results.documentsFound.clicks.byType = {
        click: clickCount,
        summary: summaryCount,
        unknown: unknownCount
      };
    } catch (error) {
      results.errorLog.push({
        operation: "clicks.get",
        error: error.message,
        stack: error.stack
      });
    }

    // Test click creation
    try {
      const crypto = require('crypto');
      const clickId = "test-" + crypto.randomBytes(8).toString('hex');
      const testData = {
        type: 'click',
        shortCode: 'diagnostic-test',
        targetUrl: 'https://example.com/diagnostic',
        userAgent: 'Diagnostic Test',
        country: 'TEST',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        day: new Date().toISOString().split('T')[0],
        diagnostic: true
      };
      
      // Try to create a document
      await clicksCollection.doc(clickId).set(testData);
      
      // Verify it exists
      const verifyDoc = await clicksCollection.doc(clickId).get();
      
      results.testResults.clickCreation = {
        success: verifyDoc.exists,
        id: clickId,
        data: verifyDoc.exists ? verifyDoc.data() : null
      };
      
      // Clean up - delete the test document
      if (verifyDoc.exists) {
        await clicksCollection.doc(clickId).delete();
        results.testResults.cleanup = "success";
      }
    } catch (error) {
      results.testResults.clickCreation = {
        success: false,
        error: error.message
      };
      results.errorLog.push({
        operation: "testClickCreation",
        error: error.message,
        stack: error.stack
      });
    }
    
    // Return the results
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(results);
  } catch (error) {
    return res.status(500).json({
      error: "Diagnostic failed",
      message: error.message,
      stack: error.stack
    });
  }
}

module.exports = {
  diagnoseHandler
}; 