# Windows PowerShell Script to Start Bitcoin On-Chain Dashboard
# This script starts the Backend (FastAPI) and Frontend (Vite) in separate windows.

# 1. Define Paths
$PROJECT_ROOT = "c:\Python\vscode\Project\BTC onchain index"
$BACKEND_DIR = "$PROJECT_ROOT\BTC INDEX Backend"
$FRONTEND_DIR = "$PROJECT_ROOT\BTC INDEX Frontend"
$VENV_PYTHON = "$PROJECT_ROOT\.venv\Scripts\python.exe"

Write-Host "🚀 Starting Bitcoin On-Chain Dashboard..." -ForegroundColor Cyan

# Check for Node.js/npm
# If npm is not found, try to refresh environment variables from Machine/User scope
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️ 'npm' not found. trying to refresh environment variables..." -ForegroundColor Yellow
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Error "❌ Node.js (npm) is still not found. Please restart VS Code or your computer to apply the installation."
        Write-Error "   If you haven't installed it, please install Node.js LTS from https://nodejs.org/"
        exit 1
    }
}

# 2. Start Backend
Write-Host "🔹 Launching Backend Server..." -ForegroundColor Yellow
if (Test-Path $VENV_PYTHON) {
    # Start Backend with NoProfile and Bypass to avoid PSSecurityException
    Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-NoExit", "-Command", "& '$VENV_PYTHON' '$BACKEND_DIR\bitcoin onchain Backend.py'"
} else {
    Write-Error "❌ Virtual Environment not found at $VENV_PYTHON"
    exit 1
}

# 3. Start Frontend
Write-Host "🔹 Launching Frontend Server..." -ForegroundColor Yellow
Set-Location $FRONTEND_DIR

# Check if node_modules exists
if (-not (Test-Path "$FRONTEND_DIR\node_modules")) {
    Write-Host "📦 Installing Frontend Dependencies (First Run Only)..." -ForegroundColor Magenta
    cmd /c "npm install"
}

# Start Vite
# Using cmd /c npm run dev might be more stable than powershell directly if powershell profile is broken
Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-NoExit", "-Command", "cd '$FRONTEND_DIR'; npm run dev -- --open"

Write-Host "✅ System Started!" -ForegroundColor Green
Write-Host "   - Backend: http://127.0.0.1:8000"
Write-Host "   - Frontend: http://localhost:5173 (Opening in browser...)"
