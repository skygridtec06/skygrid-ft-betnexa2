#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Environment variables to add
// NOTE: secret values must be supplied via environment variables at runtime, not hardcoded here.
const envVars = {
  SUPABASE_URL: "https://eaqogmybihiqzivuwyav.supabase.co",
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
  VITE_API_URL: "https://www.betnexabackend.co.ke",
  SERVER_PUBLIC_URL: "https://www.betnexabackend.co.ke",
  TEXTSMS_API_KEY: process.env.TEXTSMS_API_KEY || "",
  TEXTSMS_PARTNER_ID: "15957",
  TEXTSMS_SHORTCODE: "TextSMS",
  ADMIN_SMS_PHONE: "0740176944"
};
if (process.env.API_FOOTBALL_KEY) {
  envVars.API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
}

// Create .env files
const rootEnv = Object.entries(envVars)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

fs.writeFileSync('.env', rootEnv);
console.log('âœ… Created .env file');

// Backend env vars
const backendEnvVars = {
  PORT: "5000",
  NODE_ENV: "production",
  CALLBACK_URL: "https://www.betnexabackend.co.ke/api/callbacks",
  SUPABASE_URL: "https://eaqogmybihiqzivuwyav.supabase.co",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || "",
  DARAJA_TEST_CONSUMER_KEY: process.env.DARAJA_TEST_CONSUMER_KEY || "",
  DARAJA_TEST_CONSUMER_SECRET: process.env.DARAJA_TEST_CONSUMER_SECRET || "",
  DARAJA_TEST_PARTY_B: "4320291",
  DARAJA_TEST_PASSKEY: process.env.DARAJA_TEST_PASSKEY || "",
  DARAJA_TEST_SHORT_CODE: "4320291",
  DARAJA_TEST_TRANSACTION_TYPE: "CustomerPayBillOnline",
  DARAJA_TEST_CALLBACK_BASE_URL: "https://www.betnexabackend.co.ke",
  TEXTSMS_API_KEY: process.env.TEXTSMS_API_KEY || "",
  TEXTSMS_PARTNER_ID: "15957",
  TEXTSMS_SHORTCODE: "TextSMS",
  ADMIN_SMS_PHONE: "0740176944"
};
if (process.env.API_FOOTBALL_KEY) {
  backendEnvVars.API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
}

const backendEnv = Object.entries(backendEnvVars)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

fs.mkdirSync('server', { recursive: true });
fs.writeFileSync('server/.env', backendEnv);
console.log('âœ… Created server/.env file');

console.log('\nðŸ“‹ Environment Variables Summary:');
console.log('================================');
console.log(`Frontend (.env): ${Object.keys(envVars).length} variables`);
console.log(`Backend (server/.env): ${Object.keys(backendEnvVars).length} variables`);
console.log('\nâœ… All environment files configured!');

