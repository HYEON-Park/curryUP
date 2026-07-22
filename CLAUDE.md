# CLAUDE.md — 프로젝트 지시사항

## 서버 재시작

재시작 요청 시 반드시 아래 순서로 처리한다.

0. **AI 배치 실행 여부 먼저 확인**
   ```powershell
   Invoke-RestMethod "http://localhost:4000/api/admin/ai/status"
   ```
   - `running: true` → 사용자에게 알리고 **재시작 중단**. 명시적 허락 없이 절대 재시작하지 않는다.
   - `running: false` 또는 서버가 꺼진 상태 → 다음 단계 진행

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

# 하나만 기동 (node --import tsx: 단일 프로세스로 기동)
cd C:\R\backend; node --import tsx src/server.ts
```

## 작업 범위

요청한 것만 정확히 실행한다. 임의로 추가 작업하지 않는다.

- `commit` 요청 → commit만
- `push` 요청 → push만
- 그 외 모든 작업도 동일: 요청 범위를 벗어나지 않는다.

## 기존 구조 재사용 (중복 생성 금지)

기능을 추가할 때 **기존 데이터 구조·필드·저장 위치·배치를 먼저 재사용한다.**
같은 성격의 데이터를 새 필드/새 배치로 **중복 생성하지 않도록 사용자와 같이 더블체크한다.**

- 예: 매칭률은 `documents.matchReport` 한 곳에 쌓는다. 수동 수집(UPDATE)이든 자동 수집(스케줄)이든
  **같은 필드·같은 파일(jobPostings.json)** 에 쓴다. 트리거(수동/자동) 시점만 다를 뿐 저장 위치는 동일하다.
- 새 필드·새 저장 위치·새 배치가 정말로 필요하다고 판단되면, **만들기 전에 사용자에게 먼저 확인**한다.
  (임의로 새로 만들면 읽는 쪽마다 분기·동기화가 늘어 버그와 헛수고가 생긴다.)
- 데이터를 읽는 지점이 여러 곳이면, **판정 규칙을 한 곳(단일 함수)에 두고 공유**한다. 프런트·백엔드에
  같은 규칙을 각각 복제하지 않는다.

## 개인정보 보호

아래 파일은 경력·이력 등 개인 데이터를 포함하므로 절대 commit·push하지 않는다.

- `backend/src/data/userProfile.json`
- `backend/src/data/jobPostings.json`
- `backend/src/data/hiddenJobPostings.json`
- `backend/src/data/runLog.json`
- `backend/src/data/polished/` (폴더 전체 — 다듬은 자소서 등 개인 데이터 포함)
- `backend/src/data/purgedJobHistory.json`

아래 파일도 절대 commit·push하지 않는다.

- `.idea/`
- `backend/run_single_job.mts`
- `backend/scripts/setup.zip`

git add 전 항상 staging 대상을 확인하고, 위 파일들이 포함되어 있으면 제외한다.
