# Deployment to Vercel with Custom Domain

This document provides step-by-step instructions for deploying your Link Tracking application to Vercel and connecting it to your custom domain (dlzz.pro).

## Deploying to Vercel

1. **Export your project from Replit**
   - Use the Replit "Export to GitHub" feature, or download your project as a ZIP file

2. **Create a Vercel Account**
   - Sign up at [vercel.com](https://vercel.com) if you don't have an account already

3. **Deploy Your Project**
   - From the Vercel dashboard, click "Add New" > "Project"
   - Import your project from GitHub or upload your files
   - Configure your project settings:
     - Framework Preset: Other
     - Build Command: `npm run build`
     - Output Directory: `dist`
     - Install Command: `npm install`

4. **Set Up Environment Variables**
   - In your project settings, add the following environment variables:
     - `VITE_FIREBASE_API_KEY`: (Your Firebase API Key)
     - `VITE_FIREBASE_APP_ID`: (Your Firebase App ID)
     - `VITE_FIREBASE_PROJECT_ID`: (Your Firebase Project ID)

5. **Deploy**
   - Click "Deploy" to start the deployment process
   - Vercel will build and deploy your application

## Connecting Your Custom Domain (dlzz.pro)

1. **Add Your Domain in Vercel**
   - From your project dashboard, go to "Settings" > "Domains"
   - Enter your domain: `dlzz.pro`
   - Click "Add"

2. **Configure DNS Settings**
   - Vercel will provide you with specific DNS configuration instructions
   - You'll need to set up these records with your domain registrar (where you purchased dlzz.pro)
   - Typically, you'll need to add:
     - A CNAME record for `www.dlzz.pro` pointing to `cname.vercel-dns.com`
     - An A record for the apex domain (`dlzz.pro`) pointing to Vercel's IP addresses

3. **Verify Domain Ownership**
   - Vercel might require you to verify domain ownership
   - Follow their instructions for the verification method

4. **Wait for DNS Propagation**
   - DNS changes can take up to 48 hours to propagate globally
   - You can check propagation status with tools like [dnschecker.org](https://dnschecker.org)

## Post-Deployment

1. **Add Your Domain to Firebase Authorization**
   - You've already added dlzz.pro to your Firebase authorized domains (good job!)
   - If you plan to use `www.dlzz.pro` as well, add that to your Firebase authorized domains too

2. **Test Your Application**
   - Once DNS propagation is complete, test your application at your custom domain
   - Verify that authentication works correctly
   - Test the link creation and tracking functionality

3. **Set Up HTTPS (Optional)**
   - Vercel automatically provides HTTPS for all domains
   - No additional setup is required

## Troubleshooting

- **Authentication Issues**: Make sure your Firebase authorized domains include both the Vercel deployment URL and your custom domain
- **Environment Variables**: Verify all environment variables are correctly set in Vercel
- **Redirect Issues**: Check that your vercel.json configuration is correctly routing all requests