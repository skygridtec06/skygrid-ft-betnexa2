# Set TextSMS environment variables in Vercel
# Run this script: .\set-textsms-env.ps1

if (-not $env:TEXTSMS_API_KEY) {
    Write-Host "Set the TEXTSMS_API_KEY env var before running this script." -ForegroundColor Red
    exit 1
}
$env:TEXTSMS_PARTNER_ID = "15957"
$env:TEXTSMS_SHORTCODE = "TextSMS"
$env:ADMIN_SMS_PHONE = "0740176944"

Write-Host "Setting Vercel environment variables for TextSMS..." -ForegroundColor Green

# Set each variable in Vercel
vercel env add --force | Out-Null

Write-Host "Setting TEXTSMS_API_KEY..." -ForegroundColor Yellow
& vercel env rm TEXTSMS_API_KEY --force 2>$null
& vercel env add TEXTSMS_API_KEY 2>$null <<<"$env:TEXTSMS_API_KEY"
Write-Host "✅ TEXTSMS_API_KEY set" -ForegroundColor Green

Write-Host "Setting TEXTSMS_PARTNER_ID..." -ForegroundColor Yellow
& vercel env rm TEXTSMS_PARTNER_ID --force 2>$null
& vercel env add TEXTSMS_PARTNER_ID 2>$null <<<"15957"
Write-Host "✅ TEXTSMS_PARTNER_ID set" -ForegroundColor Green

Write-Host "Setting TEXTSMS_SHORTCODE..." -ForegroundColor Yellow
& vercel env rm TEXTSMS_SHORTCODE --force 2>$null
& vercel env add TEXTSMS_SHORTCODE 2>$null <<<"TextSMS"
Write-Host "✅ TEXTSMS_SHORTCODE set" -ForegroundColor Green

Write-Host "Setting ADMIN_SMS_PHONE..." -ForegroundColor Yellow
& vercel env rm ADMIN_SMS_PHONE --force 2>$null
& vercel env add ADMIN_SMS_PHONE 2>$null <<<"0740176944"
Write-Host "✅ ADMIN_SMS_PHONE set" -ForegroundColor Green

Write-Host "Deploying to production..." -ForegroundColor Yellow
vercel deploy --prod

Write-Host "✅ All TextSMS environment variables have been set and deployed!" -ForegroundColor Green
