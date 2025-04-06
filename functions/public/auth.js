// Authentication handling for URL Shortener
// This file manages Firebase authentication and token handling

// Store the Firebase token in session storage
function storeAuthToken(token) {
  sessionStorage.setItem('firebaseAuthToken', token);
}

// Get the stored auth token
function getAuthToken() {
  return sessionStorage.getItem('firebaseAuthToken');
}

// Remove auth token on logout
function clearAuthToken() {
  sessionStorage.removeItem('firebaseAuthToken');
}

// Add auth token to fetch requests
async function authFetch(url, options = {}) {
  const token = await getCurrentUserToken();
  
  if (!token) {
    // If no token is available, return a rejected promise
    return Promise.reject(new Error('Not authenticated'));
  }
  
  // Create headers object with Authorization header
  const headers = {
    ...(options.headers || {}),
    'Authorization': `Bearer ${token}`
  };
  
  // Return fetch with the Authorization header added
  return fetch(url, {
    ...options,
    headers
  });
}

// Get the current Firebase user
function getCurrentUser() {
  return firebase.auth().currentUser;
}

// Get the ID token for the current user
async function getCurrentUserToken() {
  const user = getCurrentUser();
  
  if (!user) {
    return null;
  }
  
  try {
    // Force token refresh = false, use cached token when available
    const token = await user.getIdToken(false);
    storeAuthToken(token);
    return token;
  } catch (error) {
    console.error('Error getting ID token:', error);
    return null;
  }
}

// Initialize auth listeners once the page loads
document.addEventListener('DOMContentLoaded', function() {
  // Set up auth state change listener
  firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
      // User is signed in
      user.getIdToken().then(token => {
        storeAuthToken(token);
        checkAuthStatus();
      });
    } else {
      // User is signed out
      clearAuthToken();
      updateUIforGuest();
    }
  });
  
  // Initial auth check
  checkAuthStatus();
  
  // Add event listener for Google login button
  const googleLoginBtn = document.getElementById('google-login');
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', signInWithGoogle);
  }
  
  // Add event listener for logout button
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', signOut);
  }
});

// Sign in with Google
function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  
  firebase.auth().signInWithPopup(provider)
    .then((result) => {
      // This gives you a Google Access Token
      const credential = result.credential;
      const token = credential.idToken;
      
      // The signed-in user info
      const user = result.user;
      
      // Store the token
      storeAuthToken(token);
      
      // Check if user is authorized
      checkUserAuthorization(user);
    })
    .catch((error) => {
      console.error('Google Sign-In Error:', error);
      showError('Authentication failed: ' + error.message);
    });
}

// Check if user is authorized
function checkUserAuthorization(user) {
  // Get the current ID token
  user.getIdToken()
    .then(idToken => {
      // Send the token to the backend for verification
      return fetch('/api/auth/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          email: user.email,
          uid: user.uid
        })
      });
    })
    .then(response => response.json())
    .then(data => {
      if (data.authorized) {
        showError('Login successful!', true);
        updateUIforAuthorizedUser(user);
      } else {
        // Sign out if not authorized
        firebase.auth().signOut();
        showError('You are not authorized to access this application.');
        updateUIforGuest();
      }
    })
    .catch(error => {
      console.error('Authorization Check Error:', error);
      showError('Authorization failed: ' + error.message);
      firebase.auth().signOut();
      updateUIforGuest();
    });
}

// Check authentication status
function checkAuthStatus() {
  const token = getAuthToken();
  
  if (!token) {
    updateUIforGuest();
    return;
  }
  
  // Verify token with backend
  fetch('/api/auth/status', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => response.json())
  .then(data => {
    if (data.authenticated) {
      updateUIforAuthorizedUser(data.user);
    } else {
      updateUIforGuest();
    }
  })
  .catch(error => {
    console.error('Auth Status Check Error:', error);
    updateUIforGuest();
  });
}

// Update UI for authorized user
function updateUIforAuthorizedUser(user) {
  document.querySelectorAll('.auth-only').forEach(el => el.style.display = 'block');
  document.querySelectorAll('.guest-only').forEach(el => el.style.display = 'none');
  
  const userDisplayEl = document.getElementById('user-display');
  if (userDisplayEl && user) {
    userDisplayEl.textContent = `Logged in as: ${user.email || user.displayName || 'User'}`;
  }
}

// Update UI for guest user
function updateUIforGuest() {
  document.querySelectorAll('.auth-only').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.guest-only').forEach(el => el.style.display = 'block');
}

// Sign out
function signOut() {
  firebase.auth().signOut()
    .then(() => {
      clearAuthToken();
      showError('Logged out successfully', true);
      updateUIforGuest();
    })
    .catch(error => {
      console.error('Sign Out Error:', error);
      showError('Logout failed: ' + error.message);
    });
}

// Show error or success message
function showError(message, isSuccess = false) {
  const errorElement = document.getElementById('error-message');
  if (!errorElement) return;
  
  errorElement.textContent = message;
  errorElement.style.display = 'block';
  
  if (isSuccess) {
    errorElement.className = 'message success';
  } else {
    errorElement.className = 'message error';
  }
  
  setTimeout(() => {
    errorElement.style.display = 'none';
  }, 5000);
} 