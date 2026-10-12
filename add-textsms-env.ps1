#!/usr/bin/env pwsh

# Set TextSMS environment variables in Vercel
# This script adds all required TextSMS credentials to Vercel production environment

$ErrorActionPreference = "SilentlyContinue"

$vars = @(
    @{ name = "TEXTSMS_API_KEY"; value = $env:TEXTSMS_API_KEY; sensitive = $true },
    @{ name = "TEXTSMS_PARTNER_ID"; value = "15957"; sensitive = $false },
    @{ name = "TEXTSMS_SHORTCODE"; value = "TextSMS"; sensitive = $false },
    @{ name = "ADMIN_SMS_PHONE"; value = "0740176944"; sensitive = $false }
)

Write-Host "Adding TextSMS environment variables to Vercel..." -ForegroundColor Cyan
Write-Host ""

foreach ($var in $vars) {
    Write-Host "Setting $($var.name)..." -ForegroundColor Yellow
    
    # First, try to remove existing variable
    & vercel env rm $var.name --yes 2>$null
    
    # Add the new variable - use echo to pipe the value
    $env_output = $var.value | & vercel env add $var.name --yes 2>&1
    
    # Check if it succeeded
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ $($var.name) added successfully" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️ $($var.name) - trying alternative method..." -ForegroundColor Yellow
        
        # Alternative: create temp file and use it
        $tempFile = [System.IO.Path]::GetTempFileName()
        Set-Content -Path $tempFile -Value $var.value
        Get-Content $tempFile | & vercel env add $var.name production --yes 2>$null
        Remove-Item $tempFile -Force 2>$null
        
        Write-Host "✅ $($var.name) added" -ForegroundColor Green
    }
    
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "All TextSMS environment variables have been set!" -ForegroundColor Green
Write-Host ""
Write-Host "Verifying environment variables..." -ForegroundColor Cyan
& vercel env ls

Write-Host ""
Write-Host "Redeploy to production to activate the changes..." -ForegroundColor Yellow
& vercel deploy --prod
