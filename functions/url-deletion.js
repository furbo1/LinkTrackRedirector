// URL Deletion API Endpoint
// Add this to functions/index.js

// Add a DELETE endpoint for URL mappings
app.delete('/api/delete-url/:shortCode', async (req, res) => {
  try {
    const shortCode = req.params.shortCode;
    
    if (!shortCode) {
      return res.status(400).json({
        error: 'Short code is required'
      });
    }
    
    console.log(`Attempting to delete URL mapping for shortCode: ${shortCode}`);
    
    // First check if the URL mapping exists
    let existingUrl = urlMappings[shortCode];
    
    if (!existingUrl) {
      try {
        // Check in Firestore
        const doc = await urlMappingsCollection.doc(shortCode).get();
        if (doc.exists) {
          existingUrl = doc.data().url;
        }
      } catch (err) {
        console.error(`Error checking Firestore for shortCode ${shortCode}:`, err);
      }
    }
    
    if (!existingUrl) {
      return res.status(404).json({
        error: 'URL mapping not found'
      });
    }
    
    // Delete from in-memory cache
    if (urlMappings[shortCode]) {
      delete urlMappings[shortCode];
      console.log(`Deleted shortCode ${shortCode} from in-memory cache`);
    }
    
    // Delete from Firestore
    try {
      await urlMappingsCollection.doc(shortCode).delete();
      console.log(`Deleted shortCode ${shortCode} from Firestore`);
    } catch (err) {
      console.error(`Error deleting from Firestore for shortCode ${shortCode}:`, err);
      // Continue even if Firestore delete fails
    }
    
    // Delete related click data from Firestore
    try {
      // Find all click documents for this shortCode
      const clickQuery = await clicksCollection.where('shortCode', '==', shortCode).get();
      
      if (!clickQuery.empty) {
        const batch = db.batch();
        clickQuery.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        console.log(`Deleted ${clickQuery.size} click records for shortCode ${shortCode} from Firestore`);
      }
    } catch (err) {
      console.error(`Error deleting click data from Firestore for shortCode ${shortCode}:`, err);
      // Continue even if click data delete fails
    }
    
    // Delete summary document if it exists
    try {
      const summaryDoc = await clicksCollection.doc(`summary_${shortCode}`).get();
      if (summaryDoc.exists) {
        await clicksCollection.doc(`summary_${shortCode}`).delete();
        console.log(`Deleted summary document for shortCode ${shortCode}`);
      }
    } catch (err) {
      console.error(`Error deleting summary document for shortCode ${shortCode}:`, err);
      // Continue even if summary delete fails
    }
    
    // Delete from Realtime Database
    try {
      await clicksRef.child(shortCode).remove();
      console.log(`Deleted click data for shortCode ${shortCode} from RTDB`);
    } catch (err) {
      console.error(`Error deleting from RTDB for shortCode ${shortCode}:`, err);
      // Continue even if RTDB delete fails
    }
    
    // Return success response
    res.json({
      success: true,
      message: `URL mapping and associated data for "${shortCode}" has been deleted successfully`
    });
    
  } catch (error) {
    console.error('Error in delete URL endpoint:', error);
    res.status(500).json({
      error: 'Failed to delete URL mapping',
      message: error.message
    });
  }
}); 