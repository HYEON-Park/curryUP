# Windows 로그온 시 backend 서버(start-server.cmd)를 자동 실행하도록 등록한다.
# 실행 전 backend에서 `npm run build`로 dist/를 먼저 만들어 두어야 한다.
# 사용: powershell -ExecutionPolicy Bypass -File .\scripts\register-startup-task.ps1
# 제거: schtasks /delete /tn CurryUpBackend /f

$TaskName = "CurryUpBackend"
$ScriptPath = Join-Path $PSScriptRoot "start-server.cmd"

schtasks /create /tn $TaskName /tr "`"$ScriptPath`"" /sc onlogon /rl limited /f

Write-Host "등록 완료: 다음 로그온부터 backend가 자동 실행됩니다 (http://localhost:4000)."
Write-Host "제거하려면: schtasks /delete /tn $TaskName /f"
