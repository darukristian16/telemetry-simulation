/**
 * Setup Telemetry Database
 * This script runs the necessary commands to set up the telemetry database.
 */

const { execSync } = require('child_process');
const path = require('path');

// Function to run shell commands
function runCommand(command) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Command failed: ${error.message}`);
    process.exit(1);
  }
}

console.log('==== Setting up telemetry database ====');

// Step 1: Run Prisma migration
console.log('\nStep 1: Running Prisma migration');
runCommand('npx prisma migrate dev --name add_telemetry_models');

// Step 2: Generate Prisma client
console.log('\nStep 2: Generating Prisma client');
runCommand('npx prisma generate');

console.log('\n==== Telemetry database setup complete ====');
console.log('You can now start the development server with:');
console.log('npm run dev');

process.exit(0); 