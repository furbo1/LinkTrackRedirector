# Deploying to Firebase with Custom Domain

This document provides step-by-step instructions for deploying your Link Tracking application to Firebase and connecting it to your custom domain (dlzz.pro).

## Prerequisites

1. **Firebase CLI Installation**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**
   ```bash
   firebase login
   ```

## Build Your Application

1. **Build the application**
   ```bash
   npm run build
   ```

## Deploy to Firebase

1. **Deploy the application**
   ```bash
   firebase deploy
   ```

   This will deploy both your hosting (frontend) and functions (backend API).

## Connect Your Custom Domain (dlzz.pro)

1. **Add Custom Domain in Firebase Console**
   - Go to the Firebase console (https://console.firebase.google.com/)
   - Select your project: "dlzz-pro-b1c80"
   - Go to Hosting in the left sidebar
   - Click on "Add custom domain"
   - Enter your domain: dlzz.pro
   - Follow the verification and DNS setup instructions provided by Firebase

2. **Update DNS Settings for Your Domain**
   - Firebase will provide you with specific DNS records to add
   - Go to your domain registrar's dashboard where you manage dlzz.pro
   - Add the DNS records Firebase provides (typically A records or CNAME records)
   - Wait for DNS propagation (can take up to 48 hours)

3. **Verify Domain Connection**
   - Firebase will automatically verify when your DNS is properly configured
   - Your site should then be accessible at your custom domain

## Environment Variables

Since we're using Firebase for deployment, your Firebase configuration variables (API key, project ID, app ID) are already set up in your Firebase project, and you don't need to worry about transferring them.

## Post-Deployment

1. **Testing Your Application**
   - Visit your custom domain once DNS has propagated
   - Verify all functionality works correctly (authentication, link creation, tracking)

2. **Monitoring**
   - Use Firebase Console to monitor your application
   - Check Cloud Functions logs if you encounter any backend issues
   - Monitor Hosting analytics to track site usage

## Troubleshooting

1. **Authentication Issues**
   - Ensure dlzz.pro is added to the authorized domains in Firebase Authentication settings

2. **Cloud Functions Errors**
   - Check the Firebase Functions logs in the Firebase Console
   - Verify your functions are deployed correctly with `firebase functions:list`

3. **Hosting Issues**
   - Verify your build output is correct
   - Check Firebase Hosting logs in the Firebase Console