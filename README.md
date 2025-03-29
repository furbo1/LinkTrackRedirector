# LinkTrackRedirector

A powerful URL shortener and click tracking application built with Firebase. This tool helps you create shortened URLs, track clicks, and analyze traffic sources in real-time.

## Features

- **URL Shortening**: Create short, memorable URLs for easy sharing
- **Click Tracking**: Detailed analytics for every click including:
  - Time and date
  - Geographic location
  - Referrer information
  - User agent details
- **Dashboard**: Monitor performance of all your shortened URLs
- **URL Preview**: View website previews before clicking
- **Performance Metrics**: Analyze URL effectiveness with a 10-point rating system
- **Cross-browser Compatible**: Works on Chrome, Firefox, and other modern browsers

## Implementation Details

### Architecture
- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js with Express
- **Database**: Firebase Firestore
- **Hosting**: Firebase Hosting

### Key Components
- **URL Shortening Service**: Creates and stores shortened URLs
- **Redirection Handler**: Redirects users and logs click data
- **Analytics Dashboard**: Displays detailed statistics and click history
- **URL Preview**: Fetches and displays metadata from target websites
- **Delete Functionality**: Multiple methods to ensure reliable URL deletion

## Usage

1. **Creating Short URLs**: 
   - Enter the target URL in the input field
   - Click "Shorten URL" to generate a short link
   - Copy and share the shortened URL

2. **Viewing Statistics**:
   - Visit the dashboard to see all your shortened URLs
   - Click "Details" to view comprehensive click data
   - Click "Preview" to see a visual preview of the target website

3. **Managing URLs**:
   - Use the "Delete" button to remove unwanted URLs
   - Sort and filter URLs based on various criteria

## Development

### Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Configure Firebase project
4. Deploy: `firebase deploy`

### File Structure
- `/functions`: Cloud Functions and server code
  - `/public`: Frontend assets and client-side code
- `firebase.json`: Firebase configuration

## Recent Improvements

- Enhanced delete functionality for reliable URL removal
- Added meta tag-based URL previews
- Implemented detailed click history display
- Fixed cross-browser compatibility issues
- Added performance indicators for URL effectiveness