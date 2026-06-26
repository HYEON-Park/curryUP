# CLAUDE.md — 프로젝트 지시사항

## 서버 재시작

재시작 요청 시 반드시 아래 순서로 처리한다.

1. WMI로 백엔드 관련 프로세스 수 확인
2. 1개만 구동 중 → kill 후 재시작
3. 2개 이상 → 전체 kill 후 1개만 기동
4. 0개 → 바로 기동

```powershell
# 전체 정리
Get-WmiObject Win32_Process | Where-Object {
  $_.CommandLine -like "*tsx*server*" -or
  $_.CommandLine -like "*npm run dev*" -or
  ($_.CommandLine -like "*tsx*" -and $_.CommandLine -like "*R\\backend*")
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

# 하나만 기동
cd C:\R\backend; npx tsx src/server.ts
```
