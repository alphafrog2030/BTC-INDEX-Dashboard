# run_update.ps1
# 이 스크립트는 백엔드 파이썬 코드를 실행하여 데이터를 갱신하고 GitHub에 업로드합니다.
# 실행 후 터미널 창은 자동으로 닫힙니다.

$ErrorActionPreference = "Stop"

# 1. 경로 설정
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$LOG_FILE = "$SCRIPT_DIR\update_log.txt"
$VENV_PYTHON = "$SCRIPT_DIR\.venv\Scripts\python.exe"
$BACKEND_SCRIPT = "$SCRIPT_DIR\BTC INDEX Backend\bitcoin onchain Backend.py"

# 로그 기록 시작 (기존 로그 덮어쓰기 or -Append)
Start-Transcript -Path $LOG_FILE -Force

try {
    Write-Host "📂 Setting working directory to: $SCRIPT_DIR"
    Set-Location -Path "$SCRIPT_DIR"

    # 2. 파이썬 스크립트 실행
    # -WindowStyle Hidden을 주면 아예 안보이게 할 수도 있지만, 
    # 사용자가 작동 여부를 인지할 수 있도록 최소화 상태로 실행하거나, 짧게 떴다 사라지게 함.
    Write-Host "🚀 Bitcoin Dashboard Auto-Updater Running..." -ForegroundColor Green
    
    if (-not (Test-Path $VENV_PYTHON)) {
        throw "Python executable not found at: $VENV_PYTHON"
    }

    # Python 출력 인코딩을 강제로 UTF-8로 설정 (이모지 출력 오류 방지)
    $env:PYTHONIOENCODING = "utf-8"

    & "$VENV_PYTHON" "-u" "$BACKEND_SCRIPT"

    Write-Host "✅ Script finished successfully."
}
catch {
    Write-Error "❌ Error occurred: $_"
}
finally {
    Stop-Transcript
}

# 3. 종료 (5초 대기 후 닫힘 - 파이썬 코드 내에서 5초 대기함)
Start-Sleep -Seconds 2
exit
