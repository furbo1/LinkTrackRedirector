# Firebase Functions Deployment Guide

Your code already implements 300-day data retention correctly. I've created multiple options for deploying your Firebase functions with the 300-day cleanup policy.

## Option 1: Interactive Bash Script (Simplest)

```bash
# From the functions directory
./deploy-simple.sh
```

This script will:
1. Guide you through Firebase login
2. Set the project
3. Deploy the functions, prompting you to enter "300" for the cleanup policy

## Option 2: ES Module Script (For Node.js)

```bash
# From project root
node manual-deploy.mjs
```

This script is compatible with your project's ES module configuration.

## Option 3: Manual Deployment

If the scripts don't work, follow these steps manually:

1. Login to Firebase:
```bash
npx firebase login
```

2. Set the active project:
```bash
npx firebase use dlzz-pro-b1c80
```

3. Deploy the functions:
```bash
# From project root
npx firebase deploy --only functions
```

4. When prompted about artifact cleanup period, enter: `300`

## Data Retention Implementation

Your code already implements 300-day data retention:

1. In `functions/index.js`, there's a constant:
   ```javascript
   // Set data retention period to 300 days (in milliseconds)
   const DATA_RETENTION_PERIOD = 300 * 24 * 60 * 60 * 1000;
   const DATA_RETENTION_DAYS = 300;
   ```

2. All URL mappings include expiration dates:
   ```javascript
   const expiresAt = new Date(now.getTime() + DATA_RETENTION_PERIOD);
   
   await urlMappingsCollection.doc(shortCode).set({
     url: url,
     createdAt: now,
     expiresAt: expiresAt
   });
   ```

3. All click tracking data includes expiration dates:
   ```javascript
   const expiresAt = new Date(now.getTime() + DATA_RETENTION_PERIOD);
   
   const clickData = {
     // ... other fields
     createdAt: now,
     expiresAt: expiresAt
   };
   ```

4. There's a cleanup function that handles expired data:
   ```javascript
   async function cleanupExpiredData() {
     // ... checks for and extends expired data
   }
   ```

## Additional Notes

* The Firebase.json file already has the cleanup policy specified
* The Firebase deployment prompt for cleanup policy simply confirms what's already in your code
* Your stored data will naturally expire after 300 days based on the code logic

## Testing Data Retention
To verify data retention is working correctly:
1. Check the `/api/data-retention` endpoint in your app
2. Look for data older than your set retention period - it should be handled by the cleanup function 