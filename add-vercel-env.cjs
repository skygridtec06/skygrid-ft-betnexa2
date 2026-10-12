#!/usr/bin/env node

/**
 * Script to add environment variables to both Vercel projects
 * Backend: betnexanew2 (at https://betnexanewbackend.vercel.app)
 * Frontend: betnexanew (at https://betnexanew.vercel.app)
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

console.log('\n');
console.log('â•”' + 'â•'.repeat(78) + 'â•—');
console.log('â•‘  ðŸ” VERCEL ENVIRONMENT VARIABLES CONFIGURATION                             â•‘');
console.log('â•‘  Backend: betnexanew2 | Frontend: betnexanew                               â•‘');
console.log('â•š' + 'â•'.repeat(78) + 'â•');

// BACKEND VARIABLES (for server/.env - deployed to betnexanew2)
// NOTE: secret values must be supplied via environment variables at runtime, not hardcoded here.
const backendVars = {
  'PORT': '5000',
  'NODE_ENV': 'production',
  'CALLBACK_URL': 'https://betnexanewbackend.vercel.app/api/callbacks',
  'SUPABASE_URL': 'https://eaqogmybihiqzivuwyav.supabase.co',
  'SUPABASE_ANON_KEY': process.env.SUPABASE_ANON_KEY || '',
  'SUPABASE_SERVICE_KEY': process.env.SUPABASE_SERVICE_KEY || '',
  'DARAJA_TEST_CONSUMER_KEY': process.env.DARAJA_TEST_CONSUMER_KEY || '',
  'DARAJA_TEST_CONSUMER_SECRET': process.env.DARAJA_TEST_CONSUMER_SECRET || '',
  'DARAJA_TEST_PARTY_B': '4320291',
  'DARAJA_TEST_PASSKEY': process.env.DARAJA_TEST_PASSKEY || '',
  'DARAJA_TEST_SHORT_CODE': '4320291',
  'DARAJA_TEST_TRANSACTION_TYPE': 'CustomerPayBillOnline',
  'DARAJA_TEST_CALLBACK_BASE_URL': 'https://betnexanewbackend.vercel.app',
  'TEXTSMS_API_KEY': process.env.TEXTSMS_API_KEY || '',
  'TEXTSMS_PARTNER_ID': '15957',
  'TEXTSMS_SHORTCODE': 'TextSMS',
  'ADMIN_SMS_PHONE': '0740176944'
};
if (process.env.API_FOOTBALL_KEY) {
  backendVars.API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
}

// FRONTEND VARIABLES (for root .env - deployed to betnexanew)
const frontendVars = {
  'SUPABASE_URL': 'https://eaqogmybihiqzivuwyav.supabase.co',
  'SUPABASE_SERVICE_KEY': process.env.SUPABASE_SERVICE_KEY || '',
  'SUPABASE_ANON_KEY': process.env.SUPABASE_ANON_KEY || '',
  'VITE_API_URL': 'https://betnexanewbackend.vercel.app',
  'SERVER_PUBLIC_URL': 'https://betnexanewbackend.vercel.app',
  'TEXTSMS_API_KEY': process.env.TEXTSMS_API_KEY || '',
  'TEXTSMS_PARTNER_ID': '15957',
  'TEXTSMS_SHORTCODE': 'TextSMS',
  'ADMIN_SMS_PHONE': '0740176944'
};
if (process.env.API_FOOTBALL_KEY) {
  frontendVars.API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
}

let backendCount = 0;
let backendFailed = [];
let frontendCount = 0;
let frontendFailed = [];

function addEnvVar(key, value, project) {
  try {
    // Escape quotes in value
    const escapedValue = value.replace(/"/g, '\\"');
    
    // For backend, we need to explicitly specify the project or change directory
    if (project === 'backend') {
      execSync(`vercel env add ${key} production --value "${escapedValue}" --scope=betnexa-august --yes 2>&1`, {
        stdio: 'pipe',
        cwd: path.join(__dirname, 'server')
      });
    } else {
      // For frontend, use current directory
      execSync(`vercel env add ${key} production --value "${escapedValue}" --scope=betnexa-august --yes 2>&1`, {
        stdio: 'pipe'
      });
    }
    return true;
  } catch (err) {
    return false;
  }
}

// Add backend variables
console.log('\nðŸ“‹ BACKEND PROJECT: betnexanew2');
console.log('   URL: https://betnexanewbackend.vercel.app');
console.log('   Directory: server/');
console.log('   Variables: ' + Object.keys(backendVars).length);
console.log('â”€'.repeat(80));

Object.entries(backendVars).forEach(([key, value]) => {
  const success = addEnvVar(key, value, 'backend');
  if (success) {
    console.log(`   âœ… ${key}`);
    backendCount++;
  } else {
    console.log(`   âš ï¸  ${key} - Check manually or set via Dashboard`);
    backendFailed.push(key);
  }
});

// Add frontend variables
console.log('\nðŸ“‹ FRONTEND PROJECT: betnexanew');
console.log('   URL: https://betnexanew.vercel.app');
console.log('   Directory: ./');
console.log('   Variables: ' + Object.keys(frontendVars).length);
console.log('â”€'.repeat(80));

Object.entries(frontendVars).forEach(([key, value]) => {
  const success = addEnvVar(key, value, 'frontend');
  if (success) {
    console.log(`   âœ… ${key}`);
    frontendCount++;
  } else {
    console.log(`   âš ï¸  ${key} - Check manually or set via Dashboard`);
    frontendFailed.push(key);
  }
});

// Summary
console.log('\n' + 'â•”' + 'â•'.repeat(78) + 'â•—');
console.log('â•‘  ðŸ“Š SUMMARY                                                               â•‘');
console.log('â•š' + 'â•'.repeat(78) + 'â•');
console.log(`\nâœ… Backend (betnexanew2):  ${backendCount}/${Object.keys(backendVars).length} variables added`);
if (backendFailed.length > 0) {
  console.log(`   Failed: ${backendFailed.join(', ')}`);
}

console.log(`âœ… Frontend (betnexanew):  ${frontendCount}/${Object.keys(frontendVars).length} variables added`);
if (frontendFailed.length > 0) {
  console.log(`   Failed: ${frontendFailed.join(', ')}`);
}

console.log('\nðŸ“ NEXT STEPS:');
console.log('   1. If any variables failed, add them manually via Vercel Dashboard');
console.log('   2. Redeploy both projects after all variables are added');
console.log('   3. Monitor deployment logs for errors');

console.log('\nðŸ”— VERCEL DASHBOARD LINKS:');
console.log('   Backend:  https://vercel.com/betnexa-august/betnexanew2/settings/environment-variables');
console.log('   Frontend: https://vercel.com/betnexa-august/betnexanew/settings/environment-variables');

console.log('\n');

