# Link Tracking Application

A comprehensive link tracking and redirect service that enables tracking of clicks on product links with advanced analytics capabilities.

## Deployment Instructions

### Deploying to Firebase (Recommended)

Since we're already using Firebase for authentication, deploying to Firebase Hosting with Firebase Functions gives us an integrated solution.

1. Install the Firebase CLI:
   ```
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```
   firebase login
   ```

3. Build the application:
   ```
   npm run build
   ```

4. Deploy to Firebase:
   ```
   firebase deploy
   ```

5. Connect your custom domain:
   - In the Firebase Console, go to Hosting
   - Click "Add custom domain"
   - Add your domain (dlzz.pro)
   - Follow Firebase's instructions for DNS setup

For more detailed instructions, see the FIREBASE_DEPLOYMENT.md file.

## Local Development

To run the application locally:

```
npm run dev
```

This will start both the backend server and frontend client.