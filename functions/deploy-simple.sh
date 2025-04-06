#!/bin/bash

# Super simple Firebase deployment script
# This handles the 300-day cleanup policy prompt interactively

echo "========================================"
echo "Simple Firebase Functions Deployment"
echo "========================================"

# Make sure we have a valid .firebaserc file
echo "Creating .firebaserc file..."
cat > .firebaserc << EOF
{
  "projects": {
    "default": "dlzz-pro-b1c80"
  }
}
EOF
echo "Created .firebaserc file"

# Interactive Firebase login
echo ""
echo "Step 1: Logging in to Firebase"
echo "-----------------------------"
echo "You'll need to authenticate with Firebase."
read -p "Press Enter to continue..."
npx firebase login

# Check if login worked
if [ $? -ne 0 ]; then
  echo "Authentication failed. Please try again manually."
  exit 1
fi

# Set the project
echo ""
echo "Step 2: Setting the active project"
echo "-----------------------------"
read -p "Press Enter to continue..."
npx firebase use dlzz-pro-b1c80

if [ $? -ne 0 ]; then
  echo "Failed to set project. Please try manually with: npx firebase use dlzz-pro-b1c80"
  exit 1
fi

# Deploy the functions
echo ""
echo "Step 3: Deploying functions"
echo "-----------------------------"
echo "When prompted about artifact cleanup period, enter: 300"
read -p "Press Enter to start deployment..."

# Check where we are 
if [[ "$PWD" == *"/functions" ]]; then
  echo "We're in the functions directory, deploying from parent..."
  cd ..
fi

# Deploy functions
npx firebase deploy --only functions

if [ $? -ne 0 ]; then
  echo "Deployment failed. Please try manually."
  exit 1
fi

echo ""
echo "========================================"
echo "Deployment completed successfully!"
echo "========================================"
echo "Your functions are now deployed with the 300-day cleanup policy."
echo "Note: Your code already implements 300-day data retention in functions/index.js"
echo "for all stored data, including expiration dates and cleanup mechanisms." 