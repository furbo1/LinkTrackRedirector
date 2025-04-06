// Script to deploy with custom cleanup policy
const { execSync } = require('child_process');

console.log('Attempting deployment with piped answer...');

try {
  // Create a deployment command that will answer "300" to any prompts
  const command = `printf "300\\n" | npx firebase-tools deploy --only functions --token "1//0c3Z3jM_YArn-CgYIARAAGAwSNwF-L9IrJ4ZICrUM51vJ_rJbux3vFHvGSOw0BSWTlY6xRf7LIh_hj-vcn1BeoBIm5jh8jFcdSzQ"`;
  
  console.log('Running command:', command);
  execSync(command, { 
    stdio: 'inherit',
    shell: '/bin/bash'
  });
  
  console.log('Deployment completed successfully!');
} catch (error) {
  console.error('Deployment failed:', error.message);
  
  // Try an alternative approach - create a script to run with yes
  console.log('\nTrying alternative approach with yes command...');
  try {
    // Create a shell script that will feed "300" to the deployment
    const shellScript = `
    #!/bin/bash
    yes "300" | npx firebase-tools deploy --only functions --token "1//0c3Z3jM_YArn-CgYIARAAGAwSNwF-L9IrJ4ZICrUM51vJ_rJbux3vFHvGSOw0BSWTlY6xRf7LIh_hj-vcn1BeoBIm5jh8jFcdSzQ"
    `;
    
    // Write the script to a file
    const fs = require('fs');
    fs.writeFileSync('deploy.sh', shellScript);
    execSync('chmod +x deploy.sh', { stdio: 'inherit' });
    
    // Run the script
    execSync('./deploy.sh', { stdio: 'inherit' });
    console.log('Alternative deployment completed successfully!');
  } catch (altError) {
    console.error('Alternative deployment failed:', altError.message);
  }
} 