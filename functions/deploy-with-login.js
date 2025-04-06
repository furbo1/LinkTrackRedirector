// Script to deploy functions with interactive login
const { execSync } = require('child_process');

console.log('=== Firebase Functions Deployment ===');
console.log('This script will log you in first and then deploy the functions.');

try {
  // First login interactively
  console.log('\n1. Logging in to Firebase (browser will open)...');
  execSync('npx firebase-tools login', { 
    stdio: 'inherit' 
  });
  
  // Then deploy only functions
  console.log('\n2. Deploying functions...');
  execSync('npx firebase-tools deploy --only functions', { 
    stdio: 'inherit' 
  });
  
  console.log('\n✅ Deployment completed successfully!');
} catch (error) {
  console.error('\n❌ Deployment process failed:', error.message);
  process.exit(1);
} 