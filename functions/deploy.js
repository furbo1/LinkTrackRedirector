const { execSync } = require('child_process');

// Debug token provided by the user
const debugToken = '2934BA8B-47A9-42C1-B9BA-5340DB805A95';

console.log('Starting deployment with debug token...');

try {
  // Deploy only functions using the debug token
  const output = execSync(`npx firebase-tools deploy --only functions --debug=${debugToken}`, {
    stdio: 'inherit'
  });
  
  console.log('Deployment completed successfully!');
} catch (error) {
  console.error('Deployment failed:', error.message);
  process.exit(1);
} 