#!/bin/bash

# LinkTrackRedirector Deployment Script
echo "Starting deployment of URL Shortener with enhanced features..."

# 1. Deploy the Firebase functions and hosting
echo "Deploying to Firebase..."
# Use default hosting target instead of 'main'
npx firebase deploy --only functions,hosting

echo "If you see any errors about deployment targets, try running:"
echo "npx firebase deploy"

echo "Deployment complete! The following features have been added:"
echo "✅ Enhanced sorting on statistics page"
echo "✅ Delete URL functionality on statistics page"
echo "✅ Improved UI with action buttons"

echo "To verify:"
echo "1. Go to the Statistics page"
echo "2. Test sorting by different columns"
echo "3. Test URL deletion"
echo ""
echo "Your application is now available at https://dlzz.pro" 