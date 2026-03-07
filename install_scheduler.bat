@echo off
:: Batch script to run register_startup.ps1 as Administrator
:: This requests UAC elevation automatically

echo Requesting Administrator privileges...

:: Run PowerShell, requesting elevation (-Verb RunAs)
PowerShell -NoProfile -ExecutionPolicy Bypass -Command "& {Start-Process PowerShell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""%~dp0register_startup.ps1""' -Verb RunAs}"

if %errorlevel% neq 0 (
    echo Failed to request admin privileges.
    pause
)
