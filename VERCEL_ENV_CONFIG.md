# VERCEL ENVIRONMENT VARIABLES CONFIGURATION
## Project: betnexanew2 (Frontend)
## Team: betnexa-august

# FRONTEND ENVIRONMENT VARIABLES (.env)
# Add these to Vercel Dashboard > Settings > Environment Variables

## Supabase Configuration
SUPABASE_URL=https://eaqogmybihiqzivuwyav.supabase.co
SUPABASE_SERVICE_KEY=<configure as a sensitive Vercel environment variable>
SUPABASE_ANON_KEY=<configure as a sensitive Vercel environment variable>

## Backend API Configuration
VITE_API_URL=https://www.betnexabackend.co.ke
SERVER_PUBLIC_URL=https://www.betnexabackend.co.ke

## Third-Party APIs
API_FOOTBALL_KEY=<configure as a sensitive Vercel environment variable>

## SMS Configuration
TEXTSMS_API_KEY=<configure as a sensitive Vercel environment variable>
TEXTSMS_PARTNER_ID=<configure as a sensitive Vercel environment variable>
TEXTSMS_SHORTCODE=<configure as a sensitive Vercel environment variable>
ADMIN_SMS_PHONE=<configure as a sensitive Vercel environment variable>

---

# BACKEND ENVIRONMENT VARIABLES (server/.env)
# Deploy to backend service separately

PORT=5000
NODE_ENV=production
CALLBACK_URL=https://www.betnexabackend.co.ke/api/callbacks

## Supabase
SUPABASE_URL=https://eaqogmybihiqzivuwyav.supabase.co
SUPABASE_ANON_KEY=<configure as a sensitive Vercel environment variable>
SUPABASE_SERVICE_KEY=<configure as a sensitive Vercel environment variable>

## Daraja/M-Pesa Configuration
DARAJA_TEST_CONSUMER_KEY=<configure as a sensitive Vercel environment variable>
DARAJA_TEST_CONSUMER_SECRET=<configure as a sensitive Vercel environment variable>
DARAJA_TEST_PARTY_B=<configure as a sensitive Vercel environment variable>
DARAJA_TEST_PASSKEY=<configure as a sensitive Vercel environment variable>
DARAJA_TEST_SHORT_CODE=<configure as a sensitive Vercel environment variable>
DARAJA_TEST_TRANSACTION_TYPE=<configure as a sensitive Vercel environment variable>
DARAJA_TEST_CALLBACK_BASE_URL=https://www.betnexabackend.co.ke

## APIs
API_FOOTBALL_KEY=<configure as a sensitive Vercel environment variable>

## SMS Configuration
TEXTSMS_API_KEY=<configure as a sensitive Vercel environment variable>
TEXTSMS_PARTNER_ID=<configure as a sensitive Vercel environment variable>
TEXTSMS_SHORTCODE=<configure as a sensitive Vercel environment variable>
ADMIN_SMS_PHONE=<configure as a sensitive Vercel environment variable>

---

## HOW TO ADD TO VERCEL

### Option 1: Via Vercel Dashboard (Recommended)
1. Go to https://vercel.com
2. Select Project: betnexanew2
3. Go to Settings > Environment Variables
4. Add each variable:
   - Name: SUPABASE_URL
   - Value: https://eaqogmybihiqzivuwyav.supabase.co
   - Select: Production âœ“
   - Click "Save"
5. Repeat for all variables above

### Option 2: Via Vercel CLI
```bash
vercel env add SUPABASE_URL production --value "https://eaqogmybihiqzivuwyav.supabase.co" --scope=betnexa-august --yes
```

### Option 3: Using env.json
Create a file called `env.json` with all variables and use Vercel CLI to bulk import them.

---

## DEPLOYMENT STATUS

âœ… Frontend (betnexanew2):
   - Latest Deployment: Ready for Production
   - URL: https://betnexanew2.vercel.app
   - Status: Environment variables READY

âœ… Backend (betnexabackend.co.ke):
   - Status: Already running
   - No Vercel deployment needed

---

## NOTES

- All hardcoded secrets in source code have been removed
- Backend URL updated from betnexarevivebackend.vercel.app to betnexabackend.co.ke
- Sensitive variables (keys, secrets) should be added via Vercel Dashboard only
- Never commit .env files to repository
