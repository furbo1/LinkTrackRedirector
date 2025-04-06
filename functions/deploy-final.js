// Final deploy script that addresses all issues
const { execSync } = require('child_process');
const fs = require('fs');

console.log('Starting final deployment attempt...');

// Make sure we're in the functions directory
const currentDir = process.cwd();
console.log('Current directory:', currentDir);

// First, let's create/update .firebaserc in the current directory
const firebaseRc = {
  "projects": {
    "default": "dlzz-pro-b1c80"
  }
};

fs.writeFileSync('.firebaserc', JSON.stringify(firebaseRc, null, 2));
console.log('Created/updated .firebaserc file');

// Create a simple temp firebase.json file to ensure it exists
const tempFirebaseJson = {
  "functions": {
    "source": ".",
    "runtime": "nodejs22"
  }
};

fs.writeFileSync('firebase.json', JSON.stringify(tempFirebaseJson, null, 2));
console.log('Created temporary firebase.json');

// Set environment variables to help the process
process.env.FIREBASE_FUNCTIONS_ARTIFACTS_TTL = '300d';
process.env.CI = 'true';

// Use project flag to specify the project directly
try {
  console.log('Attempting to deploy with project flag (Method 1)...');
  
  const cmd = `printf "300\\n" | npx firebase-tools deploy --only functions --token "1//0c3Z3jM_YArn-CgYIARAAGAwSNwF-L9IrJ4ZICrUM51vJ_rJbux3vFHvGSOw0BSWTlY6xRf7LIh_hj-vcn1BeoBIm5jh8jFcdSzQ" --project dlzz-pro-b1c80`;
  console.log(`Running command: ${cmd}`);
  
  execSync(cmd, { 
    stdio: 'inherit',
    shell: '/bin/bash'
  });
  
  console.log('Deployment complete!');
} catch (error) {
  console.error('Method 1 failed:', error.message);
  
  try {
    console.log('\nAttempting to deploy with firebaserc (Method 2)...');
    
    const cmd2 = `npx firebase-tools use dlzz-pro-b1c80 && printf "300\\n" | npx firebase-tools deploy --only functions --token "1//0c3Z3jM_YArn-CgYIARAAGAwSNwF-L9IrJ4ZICrUM51vJ_rJbux3vFHvGSOw0BSWTlY6xRf7LIh_hj-vcn1BeoBIm5jh8jFcdSzQ"`;
    console.log(`Running command: ${cmd2}`);
    
    execSync(cmd2, { 
      stdio: 'inherit',
      shell: '/bin/bash'
    });
    
    console.log('Deployment complete!');
  } catch (error2) {
    console.error('Method 2 failed:', error2.message);
    
    console.log('\nInstructions for manual deployment:');
    console.log('1. cd to your functions directory (if not already there)');
    console.log('2. Run: npx firebase login'); 
    console.log('3. Run: npx firebase use dlzz-pro-b1c80');
    console.log('4. Run: npx firebase deploy --only functions');
    console.log('5. When prompted about cleanup policy, enter: 300');
  }
} 