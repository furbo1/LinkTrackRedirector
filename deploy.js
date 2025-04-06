/**
 * Direct, minimal Firebase Functions deployment script
 * Handles the cleanup policy prompt and focuses on just deploying the functions
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Determine if we're in the functions directory or need to change to it
const inFunctionsDir = path.basename(process.cwd()) === 'functions';
const projectDir = inFunctionsDir ? '..' : '.';
const functionsDir = inFunctionsDir ? '.' : './functions';

console.log(`Current directory: ${process.cwd()}`);
console.log(`Project directory: ${path.resolve(projectDir)}`);
console.log(`Functions directory: ${path.resolve(functionsDir)}`);

// Simple function to run commands and handle errors
function runCommand(command, options = {}) {
  console.log(`Running command: ${command}`);
  try {
    const result = execSync(command, { 
      stdio: 'inherit', 
      shell: '/bin/bash',
      ...options
    });
    return { success: true, result };
  } catch (error) {
    console.error(`Command failed: ${error.message}`);
    return { success: false, error };
  }
}

// The main deployment process
async function deploy() {
  console.log('=== Starting Functions Deployment ===');
  
  // Check for parent directory firebase.json - this is crucial
  const mainConfigPath = path.join(projectDir, 'firebase.json');
  if (fs.existsSync(mainConfigPath)) {
    console.log('Found main firebase.json');
  } else {
    console.error('Main firebase.json not found!');
    return false;
  }
  
  // Ensure we're logged in
  console.log('\n=== Step 1: Checking authentication ===');
  runCommand('npx firebase-tools login --no-localhost');
  
  // Ensure the project is set
  console.log('\n=== Step 2: Setting the project ===');
  const projectSetResult = runCommand('npx firebase-tools use dlzz-pro-b1c80');
  
  // Try deployment with pipe to handle the cleanup policy prompt
  console.log('\n=== Step 3: Deploying with cleanup policy ===');
  const deployCmd = `cd ${projectDir} && printf "300\\n" | npx firebase-tools deploy --only functions`;
  
  const deployResult = runCommand(deployCmd);
  
  if (deployResult.success) {
    console.log('=== Deployment successful! ===');
    console.log('Data retention period is set to 300 days');
    return true;
  } else {
    console.log('\n=== Deployment failed, showing manual instructions ===');
    console.log('\nTo deploy manually:');
    console.log('1. cd to the project root directory');
    console.log('2. Run: npx firebase login');
    console.log('3. Run: npx firebase use dlzz-pro-b1c80');
    console.log('4. Run: npx firebase deploy --only functions');
    console.log('5. When prompted about artifact cleanup period, enter: 300');
    return false;
  }
}

// Run the deployment
deploy().then(success => {
  console.log(success ? 'Deployment completed!' : 'Deployment process finished with issues.');
}); 