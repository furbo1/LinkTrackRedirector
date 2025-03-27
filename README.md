# Link Tracking Application

A comprehensive link tracking and redirect service that enables tracking of clicks on product links with advanced analytics capabilities.

## Deployment Instructions

### Deploying to Vercel (Recommended - Free)

1. Sign up for a free account at [Vercel](https://vercel.com/)

2. Install the Vercel CLI:
   ```
   npm install -g vercel
   ```

3. Login to Vercel from the terminal:
   ```
   vercel login
   ```

4. Deploy the application:
   ```
   vercel
   ```

5. Connect your custom domain:
   - Go to your Vercel project dashboard
   - Navigate to Settings > Domains
   - Add your domain (dlzz.pro)
   - Follow Vercel's instructions for setting up DNS

### Environment Variables

Make sure to add the following environment variables in your Vercel project:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_PROJECT_ID`

These environment variables are necessary for Firebase authentication to work properly.

## Local Development

To run the application locally:

```
npm run dev
```

This will start both the backend server and frontend client.