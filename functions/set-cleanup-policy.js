// Script to explicitly set the container cleanup policy
const { execSync } = require('child_process');

console.log('Setting container cleanup policy for functions artifacts...');

try {
  // Step 1: First set the cleanup policy explicitly
  const policyCommand = `npx firebase-tools functions:artifacts:setpolicy --token "1//0c3Z3jM_YArn-CgYIARAAGAwSNwF-L9IrJ4ZICrUM51vJ_rJbux3vFHvGSOw0BSWTlY6xRf7LIh_hj-vcn1BeoBIm5jh8jFcdSzQ" --project dlzz-pro-b1c80 --location us-central1 --container 300 --non-interactive --json`;
  
  console.log('Running policy command:', policyCommand);
  const policyOutput = execSync(policyCommand, { stdio: 'inherit' });
  console.log('Cleanup policy set successfully');
  
  // Step 2: Now deploy the functions
  console.log('\nDeploying functions...');
  const deployCommand = `npx firebase-tools deploy --only functions --token "1//0c3Z3jM_YArn-CgYIARAAGAwSNwF-L9IrJ4ZICrUM51vJ_rJbux3vFHvGSOw0BSWTlY6xRf7LIh_hj-vcn1BeoBIm5jh8jFcdSzQ" --non-interactive`;
  
  console.log('Running deployment command:', deployCommand);
  const deployOutput = execSync(deployCommand, { stdio: 'inherit' });
  console.log('Deployment completed successfully!');
} catch (error) {
  console.error('Error:', error.message);
  
  // Try again with CLI version to respond to prompts
  try {
    console.log('\nAttempting direct deployment with yes pipe...');
    // Use echo to automatically respond "300" to any prompts
    const fallbackCommand = `echo "300" | npx firebase-tools deploy --only functions --token "1//0c3Z3jM_YArn-CgYIARAAGAwSNwF-L9IrJ4ZICrUM51vJ_rJbux3vFHvGSOw0BSWTlY6xRf7LIh_hj-vcn1BeoBIm5jh8jFcdSzQ"`;
    const fallbackOutput = execSync(fallbackCommand, { stdio: 'inherit' });
    console.log('Fallback deployment completed successfully!');
  } catch (fallbackError) {
    console.error('Fallback deployment failed:', fallbackError.message);
  }
} 