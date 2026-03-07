# register_startup.ps1
# 이 스크립트는 'run_update.ps1'을 윈도우 시작(로그인) 시 자동으로 실행되도록 스케줄러에 등록합니다.
# 관리자 권한으로 실행해야 할 수 있습니다.

# 관리자 권한 확인
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")) {
    Write-Warning "⚠️ 이 스크립트는 관리자 권한으로 실행해 주십시오."
    Write-Warning "   (우클릭 -> '관리자 권한으로 실행' 선택)"
    # 계속 진행은 하되, 실패할 수 있음을 알림
}

$TaskName = "BitcoinDashboardAutoUpdate"
$ScriptPath = "$PSScriptRoot\run_update.ps1"
$PowerShellPath = (Get-Command powershell).Source

# 1. 기존 작업 삭제 (중복 방지)
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# 2. 트리거 설정 (로그인 시 + 매일 6시간 간격)
# 2. 트리거 설정 (로그인 시 + 매일 6시간 간격)
$TriggerLogon = New-ScheduledTaskTrigger -AtLogon
$TriggerDaily = New-ScheduledTaskTrigger -Daily -At 12:00am 

# Daily 트리거의 Repetition 속성이 초기화되지 않는 문제 해결 (Dummy 트리거에서 복사)
$DummyTrigger = New-ScheduledTaskTrigger -Once -At 00:00 -RepetitionInterval (New-TimeSpan -Hours 6) -RepetitionDuration (New-TimeSpan -Days 1)
$TriggerDaily.Repetition = $DummyTrigger.Repetition

$Triggers = @($TriggerLogon, $TriggerDaily)

# 3. 동작 설정 (PowerShell 스크립트 실행)
# -WindowStyle Hidden 옵션으로 터미널 창을 숨김
$Action = New-ScheduledTaskAction -Execute $PowerShellPath -Argument "-ExecutionPolicy Bypass -WindowStyle Minimized -File `"$ScriptPath`""

# 4. 작업 등록
try {
    Register-ScheduledTask -TaskName $TaskName -Trigger $Triggers -Action $Action -Description "Updates Bitcoin Dashboard Data and Pushes to GitHub"
    Write-Host "✅ 성공: '$TaskName' 작업이 스케줄러에 등록되었습니다." -ForegroundColor Green
    Write-Host "   이제 컴퓨터를 켤 때와 매 6시간마다 자동으로 데이터가 업데이트됩니다." -ForegroundColor Yellow
}
catch {
    Write-Error "❌ 실패: 작업 등록 중 오류가 발생했습니다. 관리자 권한으로 실행했는지 확인해주세요."
    Write-Error $_
}

Pause
