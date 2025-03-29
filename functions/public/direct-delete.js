// Direct Delete Handler for URL Shortener
// This script provides a reliable way to delete URLs from the database

document.addEventListener('DOMContentLoaded', function() {
  // Check if we have a shortcode in the URL
  const urlParams = new URLSearchParams(window.location.search);
  const shortCode = urlParams.get('code');
  const token = urlParams.get('token');
  const returnUrl = urlParams.get('return') || '/dashboard.html';
  
  // Set up the delete form if we have a shortcode
  if (shortCode) {
    const codeDisplay = document.getElementById('shortcode-display');
    if (codeDisplay) {
      codeDisplay.textContent = shortCode;
    }
    
    const deleteForm = document.getElementById('delete-form');
    if (deleteForm) {
      deleteForm.addEventListener('submit', function(e) {
        e.preventDefault();
        executeDelete(shortCode, token, returnUrl);
      });
    }
    
    // Set the value in the input field
    const shortCodeInput = document.getElementById('shortcode-input');
    if (shortCodeInput) {
      shortCodeInput.value = shortCode;
    }

    // Auto-execute delete if code is provided in URL - optional behavior
    if (urlParams.get('auto') === 'true') {
      executeDelete(shortCode, token, returnUrl);
    }
  }
  
  // Handle direct delete button without form submission
  const directDeleteBtn = document.getElementById('direct-delete-btn');
  if (directDeleteBtn) {
    directDeleteBtn.addEventListener('click', function() {
      executeDelete(shortCode, token, returnUrl);
    });
  }
});

// Execute the delete operation
async function executeDelete(shortCode, token, returnUrl) {
  if (!shortCode) {
    showMessage('No short code provided', 'error');
    return;
  }
  
  // Show loading state
  showMessage('Deleting URL mapping...', 'info');
  document.getElementById('delete-status').style.display = 'block';
  
  try {
    // Get the current domain
    const baseUrl = window.location.origin;
    console.log('Base URL:', baseUrl);
    
    // CRITICAL FIX: Use POST with action parameter instead of DELETE
    // Firebase hosting rewrite rules forward everything to the Cloud Function
    // Using POST method with special action parameter ensures reliable routing
    const postUrl = `${baseUrl}/api/url-action`;
    console.log('Using POST method with action parameter:', postUrl);
    
    let success = false;
    let data = null;
    
    // First attempt: POST with action parameter
    try {
      console.log('Sending DELETE request via POST method');
      const postResponse = await fetch(postUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Delete-Token': token || 'direct-delete'
        },
        body: JSON.stringify({
          action: 'delete',
          shortCode: shortCode
        })
      });
      
      console.log('POST response status:', postResponse.status);
      
      // Get raw text first
      const responseText = await postResponse.text();
      console.log('Raw response text:', responseText);
      
      if (postResponse.ok) {
        // Safely try to parse as JSON
        try {
          data = JSON.parse(responseText);
          console.log('Parsed JSON response:', data);
          
          if (!data.error) {
            console.log('POST method success:', data);
            success = true;
          }
        } catch (e) {
          console.warn('Response is not valid JSON:', e, 'Raw response:', responseText);
        }
      }
    } catch (postError) {
      console.warn('POST method error, will try fallbacks:', postError);
    }
    
    // If POST method didn't work, try the direct delete endpoint
    if (!success) {
      try {
        console.log('POST method failed, trying direct-delete endpoint');
        const directUrl = `${baseUrl}/direct-delete/${shortCode}`;
        console.log('Requesting:', directUrl);
        
        const directResponse = await fetch(directUrl, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
            'Accept': 'application/json'
          }
        });
        
        console.log('Direct endpoint response status:', directResponse.status);
        
        // Get raw text first
        const directText = await directResponse.text();
        console.log('Raw direct endpoint response:', directText);
        
        if (directResponse.ok) {
          // Safely try to parse JSON
          try {
            const directData = JSON.parse(directText);
            if (!directData.error) {
              console.log('Direct endpoint success:', directData);
              success = true;
              data = directData;
            }
          } catch (e) {
            console.warn('Direct endpoint response is not valid JSON:', e, 'Raw response:', directText);
          }
        }
      } catch (directError) {
        console.warn('Direct endpoint error, will try standard API:', directError);
      }
    }
    
    // Display results based on success/failure
    if (success && data) {
      showMessage('URL successfully deleted!', 'success');
      document.getElementById('delete-result').innerHTML = `
        <div class="success-message">
          <p>URL with short code <strong>${shortCode}</strong> has been deleted successfully.</p>
          <p>Operation details: ${data.message || 'Deletion completed'}</p>
          <button onclick="window.location.href='${returnUrl}'">Return to Dashboard</button>
        </div>
      `;
      
      // Automatically redirect after 3 seconds
      setTimeout(() => {
        window.location.href = returnUrl;
      }, 3000);
    } else {
      let errorMessage = "Unknown error occurred while deleting URL";
      
      if (data && data.error) {
        errorMessage = data.error;
      }
      
      showMessage('Error: ' + errorMessage, 'error');
      document.getElementById('delete-result').innerHTML = `
        <div class="error-message">
          <p>Failed to delete URL with short code <strong>${shortCode}</strong>.</p>
          <p>Error: ${errorMessage}</p>
          <button onclick="window.location.href='${returnUrl}'">Return to Dashboard</button>
        </div>
      `;
    }
  } catch (error) {
    console.error('Delete operation error:', error);
    showMessage('Error: ' + error.message, 'error');
    document.getElementById('delete-result').innerHTML = `
      <div class="error-message">
        <p>An error occurred while trying to delete the URL.</p>
        <p>Technical details: ${error.message}</p>
        <button onclick="window.location.href='${returnUrl}'">Return to Dashboard</button>
      </div>
    `;
  }
}

// Try making a direct request to the Cloud Function URL
async function directCloudFunctionDelete(cloudFunctionUrl, shortCode, token, returnUrl) {
  try {
    showMessage('Trying direct Cloud Function request...', 'info');
    
    // Attempt POST to Cloud Function first (most reliable)
    const cloudPostUrl = `${cloudFunctionUrl}/api/url-action`;
    console.log('Sending POST to Cloud Function URL:', cloudPostUrl);
    
    try {
      const postResponse = await fetch(cloudPostUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Delete-Token': token || 'direct-delete'
        },
        body: JSON.stringify({
          action: 'delete',
          shortCode: shortCode
        })
      });
      
      if (postResponse.ok) {
        const postData = await postResponse.json();
        if (!postData.error) {
          showMessage('URL successfully deleted via cloud function!', 'success');
          document.getElementById('delete-result').innerHTML = `
            <div class="success-message">
              <p>URL with short code <strong>${shortCode}</strong> has been deleted successfully.</p>
              <p>Operation details: ${postData.message || 'Deletion completed'}</p>
              <button onclick="window.location.href='${returnUrl}'">Return to Dashboard</button>
            </div>
          `;
          
          setTimeout(() => {
            window.location.href = returnUrl;
          }, 3000);
          
          return;
        }
      }
    } catch (postError) {
      console.warn('Cloud Function POST error, trying DELETE:', postError);
    }
    
    // Fallback to DELETE if POST failed
    const directUrl = `${cloudFunctionUrl}/api/delete-url/${shortCode}`;
    console.log('Sending direct delete request to Cloud Function:', directUrl);
    
    const response = await fetch(directUrl, {
      method: 'DELETE',
      headers: {
        'Cache-Control': 'no-cache',
        'Accept': 'application/json',
        'X-Delete-Token': token || 'direct-delete'
      }
    });
    
    console.log('Direct response status:', response.status);
    const responseText = await response.text();
    
    try {
      const responseData = JSON.parse(responseText);
      console.log('Direct response data:', responseData);
      
      if (response.ok && !responseData.error) {
        showMessage('URL successfully deleted via direct request!', 'success');
        document.getElementById('delete-result').innerHTML = `
          <div class="success-message">
            <p>URL with short code <strong>${shortCode}</strong> has been deleted successfully.</p>
            <p>Operation details: ${responseData.message || 'Deletion completed'}</p>
            <button onclick="window.location.href='${returnUrl}'">Return to Dashboard</button>
          </div>
        `;
        
        // Automatically redirect after 3 seconds
        setTimeout(() => {
          window.location.href = returnUrl;
        }, 3000);
      } else {
        showMessage(responseData.error || 'Error in direct delete request', 'error');
        document.getElementById('delete-result').innerHTML = `
          <div class="error-message">
            <p>Failed to delete URL with short code <strong>${shortCode}</strong> via direct request.</p>
            <p>Error: ${responseData.error || 'Unknown error occurred'}</p>
            <button onclick="window.location.href='${returnUrl}'">Return to Dashboard</button>
          </div>
        `;
      }
    } catch (e) {
      console.warn('Response is not valid JSON:', e);
      showMessage('Invalid response from server', 'error');
      document.getElementById('delete-result').innerHTML = `
        <div class="error-message">
          <p>Received invalid response from server.</p>
          <p>Raw response: ${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}</p>
          <button onclick="window.location.href='${returnUrl}'">Return to Dashboard</button>
        </div>
      `;
    }
  } catch (error) {
    console.error('Direct Cloud Function request error:', error);
    showMessage('Error in direct request: ' + error.message, 'error');
    document.getElementById('delete-result').innerHTML = `
      <div class="error-message">
        <p>An error occurred with the direct Cloud Function request.</p>
        <p>Technical details: ${error.message}</p>
        <button onclick="window.location.href='${returnUrl}'">Return to Dashboard</button>
      </div>
    `;
  }
}

// Display a status message
function showMessage(message, type = 'info') {
  const statusElement = document.getElementById('delete-status');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = 'status ' + type;
    statusElement.style.display = 'block';
  }
} 