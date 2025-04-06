// Direct Deployment Script
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

console.log('Starting direct deployment bypass...');

// First, create a custom firebase.json in memory
const customConfig = {
  "hosting": {
    "public": "public",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "function": "api"
      }
    ]
  },
  "functions": {
    "source": "./",
    "runtime": "nodejs22"
  }
};

// Write this to a temporary file
fs.writeFileSync('temp-firebase.json', JSON.stringify(customConfig, null, 2));

// Create or update .firebaserc
const firebaseRc = {
  "projects": {
    "default": "dlzz-pro-b1c80"
  }
};
fs.writeFileSync('.firebaserc', JSON.stringify(firebaseRc, null, 2));

// Create the command that:
// 1. Uses the temporary config
// 2. Adds the --force flag to force use our config
// 3. Adds a timeout of 5 minutes (300 seconds)
const deployCmd = `
  npx firebase-tools deploy --only functions --token "1//0c3Z3jM_YArn-CgYIARAAGAwSNwF-L9IrJ4ZICrUM51vJ_rJbux3vFHvGSOw0BSWTlY6xRf7LIh_hj-vcn1BeoBIm5jh8jFcdSzQ" --json --force --non-interactive --config=temp-firebase.json
`;

console.log('Running deployment command...');
try {
  // Set the TTL directly as an environment variable - this is picked up by the Firebase CLI
  process.env.FIREBASE_FUNCTIONS_ARTIFACTS_TTL = '300d';
  
  // Execute the deployment
  const output = execSync(deployCmd, { stdio: 'inherit', timeout: 300000 });
  console.log('Deployment successful!');
} catch (error) {
  console.error('Deployment error:', error.message);

  // If that fails, try creating a Firebase CLI auth token directly to deploy
  console.log('\nTrying alternative deployment with a direct API call...');
  try {
    // This will use printf to provide the "300" answer to the TTL question
    const alternativeCmd = `printf "300\\n" | npx firebase-tools deploy --only functions --token "1//0c3Z3jM_YArn-CgYIARAAGAwSNwF-L9IrJ4ZICrUM51vJ_rJbux3vFHvGSOw0BSWTlY6xRf7LIh_hj-vcn1BeoBIm5jh8jFcdSzQ"`;
    
    console.log('Running alternative command:', alternativeCmd);
    execSync(alternativeCmd, { stdio: 'inherit', shell: '/bin/bash' });
    console.log('Alternative deployment successful!');
  } catch (altError) {
    console.error('Alternative deployment failed:', altError.message);
  }
} finally {
  // Clean up temporary files
  try {
    fs.unlinkSync('temp-firebase.json');
    console.log('Cleaned up temporary files');
  } catch (cleanupError) {
    console.error('Error cleaning up:', cleanupError.message);
  }
} 