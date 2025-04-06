#!/bin/bash

echo "Starting Firebase Functions deployment with auto-answer..."

# Create a temporary firebase.json file with functions configuration
cat > temp-firebase.json << EOF
{
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
}
EOF

# Set permissions for execution
chmod +x temp-firebase.json

# Method 1: Using printf to pipe the answer
echo "Attempting deployment with printf method..."
printf "300\n" | npx firebase-tools deploy --only functions --token "1//0c3Z3jM_YArn-CgYIARAAGAwSNwF-L9IrJ4ZICrUM51vJ_rJbux3vFHvGSOw0BSWTlY6xRf7LIh_hj-vcn1BeoBIm5jh8jFcdSzQ" --config=temp-firebase.json

# If that fails, try method 2: Using expect-like approach with yes
if [ $? -ne 0 ]; then
  echo "First method failed, trying deployment with yes command..."
  yes "300" | npx firebase-tools deploy --only functions --token "1//0c3Z3jM_YArn-CgYIARAAGAwSNwF-L9IrJ4ZICrUM51vJ_rJbux3vFHvGSOw0BSWTlY6xRf7LIh_hj-vcn1BeoBIm5jh8jFcdSzQ" --config=temp-firebase.json
fi

# If that fails, try method 3: Using --force flag
if [ $? -ne 0 ]; then
  echo "Second method failed, trying with force flag..."
  export FIREBASE_FUNCTIONS_ARTIFACTS_TTL=300d
  npx firebase-tools deploy --only functions --token "1//0c3Z3jM_YArn-CgYIARAAGAwSNwF-L9IrJ4ZICrUM51vJ_rJbux3vFHvGSOw0BSWTlY6xRf7LIh_hj-vcn1BeoBIm5jh8jFcdSzQ" --force --non-interactive --config=temp-firebase.json
fi

# Cleanup
rm -f temp-firebase.json
echo "Deployment process completed."
    