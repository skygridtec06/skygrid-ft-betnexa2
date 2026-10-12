# TextSMS Configuration - Vercel Environment Setup

## Credentials to Add to Vercel

Add these environment variables to your Vercel project at: https://vercel.com/nel-developers/betnexa/settings/environment-variables

```
TEXTSMS_API_KEY = <redacted — see Vercel dashboard, not committed>
TEXTSMS_PARTNER_ID = 15957
TEXTSMS_SHORTCODE = TextSMS
ADMIN_SMS_PHONE = 0740176944
```

## Steps to Add:

1. Go to: https://vercel.com/nel-developers/betnexa/settings/environment-variables
2. Click "Add New" for each variable
3. Enter the variable name and value
4. Select Environment: "Production" 
5. Click "Save"
6. After adding all 4 variables, go to Deployments tab and click "Redeploy" on the latest deployment

## Variables Explained:

- **TEXTSMS_API_KEY**: Your TextSMS API authentication key
- **TEXTSMS_PARTNER_ID**: Your TextSMS partner ID  
- **TEXTSMS_SHORTCODE**: SMS sender name (TextSMS)
- **ADMIN_SMS_PHONE**: Admin phone number to receive notifications (0740176944)

## Testing SMS Notifications:

Once deployed, admin will receive SMS notifications on **0740176944** whenever:
- ✅ User deposits money (PayHero)
- ✅ User pays withdrawal activation fee (Daraja)
- ✅ User pays priority fee (Daraja)  
- ✅ Admin manually activates user withdrawal

Each SMS includes:
- User phone number
- Username
- Deposit amount
- Time of transaction
- Transaction type
- Total platform revenue

---

**Do this NOW to activate SMS notifications!**
