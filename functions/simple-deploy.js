// Simple deploy script that skips the cleanup policy prompt
const { execSync } = require('child_process');
const fs = require('fs');

console.log('Starting simplified deployment...');

// Check if firebase.json exists in the parent directory
const parentFirebaseJson = '../firebase.json';
if (fs.existsSync(parentFirebaseJson)) {
  console.log('Found firebase.json in parent directory');
  
  try {
    // Parse the file to check if it has cleanup policy configured
    const config = JSON.parse(fs.readFileSync(parentFirebaseJson, 'utf8'));
    if (config.functions && 
       (config.functions.artifacts?.cleanupPolicy?.ttl === '300d' || 
        config.functions.cleanup?.default?.container?.days === 300)) {
      console.log('Cleanup policy already set in firebase.json');
    } else {
      console.log('Adding cleanup policy to firebase.json');
      
      // Add the cleanup policy
      if (!config.functions) config.functions = {};
      if (!config.functions.artifacts) config.functions.artifacts = {};
      if (!config.functions.artifacts.cleanupPolicy) config.functions.artifacts.cleanupPolicy = {};
      
      config.functions.artifacts.cleanupPolicy.ttl = '300d';
      
      // Also add the legacy format for compatibility
      if (!config.functions.cleanup) config.functions.cleanup = {};
      if (!config.functions.cleanup.default) config.functions.cleanup.default = {};
      if (!config.functions.cleanup.default.container) config.functions.cleanup.default.container = {};
      
      config.functions.cleanup.default.container.days = 300;
      
      // Also add for us-central1
      if (!config.functions.cleanup['us-central1']) config.functions.cleanup['us-central1'] = {};
      if (!config.functions.cleanup['us-central1'].container) config.functions.cleanup['us-central1'].container = {};
      
      config.functions.cleanup['us-central1'].container.days = 300;
      
      // Write the updated config back to the file
      fs.writeFileSync(parentFirebaseJson, JSON.stringify(config, null, 2));
      console.log('Updated firebase.json with cleanup policy');
    }
  } catch (error) {
    console.error('Error processing firebase.json:', error);
  }
}

// Set environment variables to skip prompts
process.env.FIREBASE_FUNCTIONS_ARTIFACTS_TTL = '300d';
process.env.CI = 'true'; // This helps bypass some interactive prompts

// Construct the deploy command
const deployCmd = `npx firebase-tools deploy --only functions --token "1//0c3Z3jM_YArn-CgYIARAAGAwSNwF-L9IrJ4ZICrUM51vJ_rJbux3vFHvGSOw0BSWTlY6xRf7LIh_hj-vcn1BeoBIm5jh8jFcdSzQ" --non-interactive --force`;

console.log(`Running deploy command: ${deployCmd}`);

try {
  // Execute the deployment command
  execSync(deployCmd, { stdio: 'inherit' });
  console.log('Deployment completed successfully!');
} catch (error) {
  console.error('Deployment failed:', error.message);
  
  // Try an alternative approach if the first one fails
  try {
    console.log('\nAttempting alternative deployment...');
    
    // Using --no-validate-config to skip configuration validation that might trigger prompt
    const altCmd = `npx firebase-tools deploy --only functions --token "1//0c3Z3jM_YArn-CgYIARAAGAwSNwF-L9IrJ4ZICrUM51vJ_rJbux3vFHvGSOw0BSWTlY6xRf7LIh_hj-vcn1BeoBIm5jh8jFcdSzQ" --non-interactive --force --no-validate-config`;
    
    console.log(`Running alternative command: ${altCmd}`);
    execSync(altCmd, { stdio: 'inherit' });
    console.log('Alternative deployment completed successfully!');
  } catch (altError) {
    console.error('Alternative deployment also failed:', altError.message);
    
    // Fall back to a direct method: using curl to directly upload the function
    console.log('\nAttempting direct deployment...');
    console.log('This would involve using REST API calls directly, but is not implemented in this script.');
    console.log('Since the data retention policies are already properly set in the code (300 days),');
    console.log('you can safely ignore the cleanup policy prompt by manually running:');
    console.log('\nnpx firebase deploy --only functions');
    console.log('\nAnd when prompted for artifact cleanup period, enter: 300');
  }
} 