# Caliskan Business: Expo SDK 54 -> 57
# Run from the repository root or any directory on Windows PowerShell.
$ErrorActionPreference = "Stop"
$project = Split-Path -Parent $PSScriptRoot
Set-Location $project
Write-Host "Caliskan Business Expo SDK 57 upgrade" -ForegroundColor Cyan
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is not installed." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm is not installed." }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Git is not installed." }
$changes = git status --porcelain -- .
if ($LASTEXITCODE -ne 0) { throw "Git status failed." }
if ($changes) { throw "Uncommitted changes exist in business-mobile. Commit or stash them before upgrading." }
npm install "expo@^57.0.23"
if ($LASTEXITCODE -ne 0) { throw "Expo package installation failed." }
npx expo install --fix
if ($LASTEXITCODE -ne 0) { throw "Expo dependency alignment failed." }
npx expo install --check
if ($LASTEXITCODE -ne 0) { throw "Expo dependency check failed." }
npx expo-doctor
if ($LASTEXITCODE -ne 0) { Write-Warning "Expo Doctor found issues; review before committing." }
Write-Host "Upgrade complete locally. Review package.json and package-lock.json, then run npm run typecheck and npx expo start --go --clear." -ForegroundColor Green
