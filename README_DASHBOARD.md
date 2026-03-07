# 🚀 How to Run the Bitcoin On-Chain Dashboard

## Quick Start (Beginner)
1. **Double-click** or run the `start_dashboard.ps1` script in PowerShell.
   ```powershell
   .\start_dashboard.ps1
   ```
2. Two black windows (terminals) will open:
   - **Backend**: Runs the Python data server (Analysis engine).
   - **Frontend**: Runs the Web Dashboard.
3. Your web browser should automatically open to the dashboard (e.g., `http://localhost:5173`).

## Troubleshooting
- **Frontend didn't open?**
  - If you see `'npm' is not recognized`, please **RESTART VS Code** completely.
  - I have installed Node.js for you, but VS Code needs a restart to see it.
- **PowerShell Security Error?**
  - The script now bypasses execution policies automatically. If it still fails, try run as Administrator.
- **Data says "Loading..." forever?**
  - Check the **Backend** terminal window. Does it show "Uvicorn running on..."?

## Features
- **Real-time Price**: Fetched from Yahoo Finance / CoinGecko.
- **On-Chain Indicators**: MVRV Z-Score, Puell Multiple, NUPL (Calculated or Scraped).
- **Investment Score**: 0-100 Score based on weighted analysis.
