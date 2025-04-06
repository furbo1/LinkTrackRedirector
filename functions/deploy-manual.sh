#!/bin/bash

echo "========================================"
echo "Firebase Functions Manual Deployment"
echo "This script will guide you through the deployment process"
echo "========================================"

# Find the Firebase CLI
FIREBASE_CLI=$(which firebase)
if [ -z "$FIREBASE_CLI" ]; then
  FIREBASE_CLI="npx firebase-tools"
  echo "Using npx firebase-tools since firebase CLI is not installed globally"
else
  echo "Using global firebase CLI at $FIREBASE_CLI"
fi

# Prepare files needed for deployment
echo "Creating temporary configuration files..."

# Create .firebaserc
cat > .firebaserc << EOF
{
  "projects": {
    "default": "dlzz-pro-b1c80"
  }
}
EOF
echo "Created .firebaserc file"

# Create temporary firebase.json
cat > firebase.json << EOF
{
  "functions": {
    "source": ".",
    "runtime": "nodejs22",
    "cleanup": {
      "default": {
        "container": {
          "days": 300
        }
      },
      "us-central1": {
        "container": {
          "days": 300
        }
      }
    },
    "artifacts": {
      "cleanupPolicy": {
        "ttl": "300d"
      }
    }
  }
}
EOF
echo "Created firebase.json with cleanup policy"

echo "========================================"
echo "Starting deployment process..."
echo "========================================"

# Try Method 1: Set project explicitly with --project flag
echo "Attempting deployment with project flag (Method 1)..."
printf "300\n" | $FIREBASE_CLI deploy --only functions --project dlzz-pro-b1c80

# Check if it failed
if [ $? -ne 0 ]; then
  echo "Method 1 failed, trying authentication first..."
  
  # Try authentication
  echo "Attempting to run firebase login..."
  $FIREBASE_CLI login
  
  # Set the project
  echo "Setting active project..."
  $FIREBASE_CLI use dlzz-pro-b1c80
  
  # Try deployment again
  echo "Attempting deployment after login (Method 2)..."
  printf "300\n" | $FIREBASE_CLI deploy --only functions
  
  # Check if it failed again
  if [ $? -ne 0 ]; then
    echo "Method 2 failed, trying direct token authentication..."
    
    # Try with token authentication
    echo "Attempting deployment with token (Method 3)..."
    printf "300\n" | $FIREBASE_CLI deploy --only functions --token "1//0c3Z3jM_YArn-CgYIARAAGAwSNwF-L9IrJ4ZICrUM51vJ_rJbux3vFHvGSOw0BSWTlY6xRf7LIh_hj-vcn1BeoBIm5jh8jFcdSzQ" --project dlzz-pro-b1c80
    
    # Final check
    if [ $? -ne 0 ]; then
      echo "========================================"
      echo "All automated methods failed."
      echo "Manual instructions:"
      echo "1. Run: firebase login"
      echo "2. Run: firebase use dlzz-pro-b1c80"
      echo "3. Run: firebase deploy --only functions"
      echo "4. When prompted about cleanup policy, enter: 300"
      echo "========================================"
      exit 1
    fi
  fi
fi

echo "========================================"
echo "Deployment process completed!"
echo "The data retention period is set to 300 days"
echo "========================================" 