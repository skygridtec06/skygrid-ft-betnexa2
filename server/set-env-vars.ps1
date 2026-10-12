# Set environment variables on Vercel
# This script adds the Supabase configuration to Vercel

Write-Host "Setting environment variables on Vercel..."

# Note: These commands need to be run interactively
# Open Vercel dashboard manually:
# 1. Go to: https://vercel.com/nel-developers/server/settings/environment-variables
# 2. Add these variables with "Production" scope:

Write-Host ""
Write-Host "=== ENVIRONMENT VARIABLES TO ADD ==="
Write-Host ""
Write-Host "Variable 1:"
Write-Host "Name: SUPABASE_URL"
Write-Host "Value: https://eaqogmybihiqzivuwyav.supabase.co"
Write-Host "Environments: Production"
Write-Host ""
Write-Host "Variable 2:"
Write-Host "Name: SUPABASE_ANON_KEY"
Write-Host "Value: <set via SUPABASE_ANON_KEY env var, do not hardcode>"
Write-Host "Environments: Production"
Write-Host ""
Write-Host "Variable 3:"
Write-Host "Name: SUPABASE_SERVICE_KEY"
Write-Host "Value: <set via SUPABASE_SERVICE_KEY env var, do not hardcode>"
Write-Host "Environments: Production"
Write-Host ""
Write-Host "After adding these, Vercel will automatically redeploy."
