#!/usr/bin/env powershell

# Set environment variables on Vercel for the server
Write-Host ""
Write-Host "🔐 Setting Supabase environment variables on Vercel..." -ForegroundColor Cyan
Write-Host ""

# The correct Supabase credentials
$env:SUPABASE_URL = "https://eaqogmybihiqzivuwyav.supabase.co"
if (-not $env:SUPABASE_ANON_KEY -or -not $env:SUPABASE_SERVICE_KEY) {
    Write-Host "Set SUPABASE_ANON_KEY and SUPABASE_SERVICE_KEY env vars before running this script." -ForegroundColor Red
    exit 1
}

Write-Host "📋 Setting variables:" -ForegroundColor Green
Write-Host "   SUPABASE_URL=$env:SUPABASE_URL"
Write-Host "   SUPABASE_ANON_KEY=$($env:SUPABASE_ANON_KEY.Substring(0,30))..."
Write-Host "   SUPABASE_SERVICE_KEY=$($env:SUPABASE_SERVICE_KEY.Substring(0,30))..."
Write-Host ""

# Navigate to server directory
cd "c:\Users\user\Downloads\BETNEXA PROFESSIONAL\server"

# Set variables on Vercel
Write-Host "🚀 Deploying to Vercel with new environment variables..." -ForegroundColor Green
Write-Host ""

# Use vercel env add to set the variables
Write-Host "Setting SUPABASE_URL..."
vercel env add SUPABASE_URL "https://eaqogmybihiqzivuwyav.supabase.co" --prod 2>&1
Write-Host ""

Write-Host "Setting SUPABASE_ANON_KEY..."
vercel env add SUPABASE_ANON_KEY $env:SUPABASE_ANON_KEY --prod 2>&1
Write-Host ""

Write-Host "Setting SUPABASE_SERVICE_KEY..."
vercel env add SUPABASE_SERVICE_KEY $env:SUPABASE_SERVICE_KEY --prod 2>&1
Write-Host ""

Write-Host "Redeploying server with new environment variables..."
vercel --prod --force 2>&1

Write-Host ""
Write-Host "✅ Done!" -ForegroundColor Green
Write-Host ""
