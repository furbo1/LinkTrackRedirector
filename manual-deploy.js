/**
 * Interactive manual deployment script
 * 
 * This script guides you through a manual deployment process
 * with clear instructions at each step.
 */

const { execSync } = require('child_process');
const readline = require('readline');

// Create readline interface for user interaction
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt user to continue
function promptContinue(message) {
  return new Promise((resolve) => {
    rl.question(`${message} (Press Enter to continue)`, () => {
      resolve();
    });
  });
}

// Function to run a command
function runCommand(command) {
  console.log(`\nRunning: ${command}\n`);
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Command failed: ${error.message}`);
    return false;
  }
}

// Main deployment function
async function deploy() {
  console.log('=============================================');
  console.log('Firebase Functions Manual Deployment Guide');
  console.log('=============================================');
  console.log('This script will guide you through deploying your Firebase Functions');
  console.log('with a 300-day data retention period.\n');
  
  // Step 1: Login to Firebase
  console.log('STEP 1: Login to Firebase');
  console.log('-------------------------');
  console.log('You will need to authenticate with Firebase.');
  await promptContinue('A browser window will open for you to log in.');
  
  if (!runCommand('npx firebase login')) {
    console.log('\nAuthentication failed. Please try again manually with:');
    console.log('npx firebase login');
    rl.close();
    return;
  }
  
  // Step 2: Set the project
  console.log('\nSTEP 2: Set the active project');
  console.log('-----------------------------');
  await promptContinue('Now we will set the active project to dlzz-pro-b1c80.');
  
  if (!runCommand('npx firebase use dlzz-pro-b1c80')) {
    console.log('\nFailed to set project. Please try manually with:');
    console.log('npx firebase use dlzz-pro-b1c80');
    rl.close();
    return;
  }
  
  // Step 3: Deploy functions
  console.log('\nSTEP 3: Deploy Functions');
  console.log('----------------------');
  console.log('We will now deploy the functions.');
  console.log('IMPORTANT: When prompted about artifact cleanup period, enter: 300');
  await promptContinue('');
  
  if (!runCommand('npx firebase deploy --only functions')) {
    console.log('\nDeployment failed. You can try manually with:');
    console.log('npx firebase deploy --only functions');
    rl.close();
    return;
  }
  
  // Deployment successful
  console.log('\n=============================================');
  console.log('Deployment completed successfully!');
  console.log('=============================================');
  console.log('Your functions are now deployed with a 300-day data retention period.');
  console.log('Note: Your code already implements 300-day data retention in functions/index.js');
  console.log('for all stored data with proper expiration dates and cleanup mechanisms.');
  
  rl.close();
}

// Run the deployment
deploy(); 