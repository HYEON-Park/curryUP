# CHANGELOG

프로젝트 주요 변경 이력. 최신이 위. 각 항목에는 수정한 소스 파일명을 함께 기록한다.

## 2026-07-28

### 이메일 로그인 + 유저별 파일 격리(멀티테넌트) 전환
- 단일 유저 앱을 이메일/비밀번호 로그인 기반 멀티테넌트로 전환. DB 없이 파일 저장소만 확장.
- **이메일 인증(링크 방식)**: 가입 시 인증 토큰 생성 → 메일 발송(`nodemailer`), 인증 전 로그인 차단(403). 인증 링크(`GET /api/auth/verify`) 클릭 시 완료 후 `/login?verified=1`로 리다이렉트. 재발송 `POST /api/auth/resend`. 인증 링크 base URL은 **LAN IP**(`utils/network.getBaseUrl`, 예: `http://192.168.110.160:4000`)로 생성해 같은 네트워크의 폰에서도 열림. SMTP는 `.env`(SMTP_HOST/PORT/SECURE/USER/PASS/MAIL_FROM); 미설정 시 인증 링크를 응답(devLink)·서버 로그로 노출하는 개발 폴백. `users.json`에 `emailVerified`·`verifyToken`·`verifyExpires` 필드 추가. JWT 시크릿은 ESM import 순서 때문에 lazy 로드로 수정(.env 반영). 신규: `src/auth/mailer.ts`, `src/utils/network.ts`.
- **인증**: `POST /api/auth/signup`(bcryptjs cost 10, 비번 8~64자)·`/login`(JWT 발급)·`GET /me`(hasProfile 반환). `authMiddleware`가 Bearer 토큰 검증 후 `req.user={userId,email}` 주입. JWT_SECRET은 `backend/.env`.
- **유저별 파일 격리**: `backend/src/data/` 아래 `profiles/`·`jobPostings/`·`hiddenJobPostings/`·`purgedJobHistory/`·`runLog/`에 `{userId}.json` 개별 파일로 분리(동시 쓰기 충돌 원천 차단). store.ts의 모든 get/save가 `userId` 인자를 받도록 리팩터, 서버 기동 시 폴더 자동 생성.
- **배치 대상 = "가장 최근 로그인 + 프로필 충족" 유저 1명**(`getBatchUserId`). 전체 유저 루프 안 함(로컬 headless Claude CLI 과부하 방지). 스케줄 cron(21시 스크래핑·09:30 알림)은 이 유저 기준, 수동 트리거(UPDATE·관리자 버튼)는 로그인 유저 본인 기준. 매칭률·문서작성 프롬프트의 파일 경로도 유저별로 치환.
- **hasProfile 판정**은 오늘 만든 `isProfileConfigured`(필수값=희망직무≥1+경력년차) 재사용.
- **프런트**: 토큰 localStorage 저장, 모든 API에 Authorization 헤더 주입(401 시 자동 로그아웃), `AuthProvider`가 `/me`로 인증·프로필 상태 확인. 로그인/회원가입 페이지 신설, 라우트 가드(미인증→`/login`, 인증+프로필없음→`/profile/setup` 강제), 네비에 이메일·로그아웃.
- 기동 시 "프로필 설정 필요" OS 알림(server.ts) 제거(멀티테넌트에서 전역 프로필 개념 소멸). tsx watch 제외에 `src/data/**/*.json` 추가(유저별 파일 쓰기마다 서버 재시작 방지). `.gitignore`·CLAUDE.md 개인정보 목록에 유저별 폴더·`.env` 추가.
- 검증: 백엔드·프런트 `tsc --noEmit` 통과(에러 0). 실제 SMTP(Gmail 앱 비밀번호) 연결·발송 확인. 기존 단일 파일 실데이터 → seed 계정(`hyeonpaaark@gmail.com`) 마이그레이션 완료(공고 88건 등, 레거시 원본은 백업 보존). 배치 시퀀스(UPDATE→평점→매칭률→문서작성) 실행 검증: 유저별 파일 기록 정상, 21시 스케줄 cron 자동 실행 확인(문서작성은 headless `claude` CLI 일시 오류로 수동 1회 실패·스케줄 1회 성공).
- 신규(백엔드): `src/auth/jwt.ts`, `src/routes/auth.ts`. 신규(프런트): `src/auth/AuthContext.tsx`, `src/pages/LoginPage.tsx`.
- 수정(백엔드): `src/data/store.ts`, `src/scheduler/runLog.ts`·`scrapeJob.ts`·`notifyJob.ts`·`ratingCheckJob.ts`·`matchCheckJob.ts`·`writeDocumentsJob.ts`, `src/pipeline/runScrapeAndMatch.ts`·`updateCompanyRatings.ts`, `src/routes/profile.ts`·`jobs.ts`·`collect.ts`·`admin.ts`, `src/server.ts`, `package.json`. 수정(프런트): `src/api/client.ts`, `src/App.tsx`, `src/main.tsx`, `src/pages/ProfileEditPage.tsx`, `src/App.css`.

### 프로필 미작성 시 배치 실행 차단 + 프로필 필수값 validation
- 프로필 필수값이 없으면 매칭 기준이 없어 **공고 스크래핑·매칭률 조회·문서 작성 배치**(및 대시보드 UPDATE 수집)를 실행하지 않는다. **오전 프로필 알림 배치(notify)는 프로필과 무관하므로 제외**
- **필수값 = 희망 직무 카테고리 ≥1 + 경력(년차)**. 저장 여부(`lastProfileUpdate`)가 아니라 이 필수값이 실제로 채워졌는지로 판정 — 단일 함수로 공유(중복 방지): 백엔드 `store.isProfileConfigured`/`hasProfile`, 프런트 `profileGuard.isProfileConfigured`
- 프런트: 배치 버튼 클릭 시 필수값 미작성이면 `"프로필을 먼저 작성해주세요."` alert → 확인 시 `navigate("/profile")`(SPA 내부 이동)
- 프로필 편집(`/profile/edit`) 저장 시 필수값 validation 추가 — 미입력이면 저장 차단·안내 문구 표시, **미입력 필드로 포커스 이동**(년차 input focus / 카테고리 fieldset scrollIntoView + 첫 조작 요소 focus), 두 항목 라벨에 `*` 표시. 백엔드 `PUT /api/profile`도 동일 필수값 방어(400)
- 배치 가드 위치(프런트 우회·자동 스케줄 대비 방어): `collect`·`scrape/run` 라우트 400(NO_PROFILE), 21시 스크래핑 cron(`scrapeTask`)·collect 체인/스케줄 공통 진입점 `runMatchCheckIfNeeded`/`runWriteDocumentsIfNeeded`는 조용히 건너뜀
- 검증: 백엔드·프런트 `tsc --noEmit` 통과(에러 0)
- 신규: `frontend/src/utils/profileGuard.ts`
- 수정: `backend/src/data/store.ts`, `backend/src/routes/collect.ts`, `backend/src/routes/admin.ts`, `backend/src/routes/profile.ts`, `backend/src/scheduler/scrapeJob.ts`, `backend/src/scheduler/matchCheckJob.ts`, `backend/src/scheduler/writeDocumentsJob.ts`, `frontend/src/pages/DashboardPage.tsx`, `frontend/src/pages/AdminBatchPage.tsx`, `frontend/src/pages/ProfileEditPage.tsx`, `frontend/src/App.css`

## 2026-07-27

### 공고 상세 페이지에 즐겨찾기·삭제 버튼 추가 — 대시보드와 통합 관리
- 상세 페이지 상단에 삭제(`×`) → 즐겨찾기(`☆/★`) → 목록으로 순의 액션 헤더(`.job-detail-header`) 신설
- 즐겨찾기·삭제 모두 대시보드 카드와 **같은 엔드포인트·같은 필드를 재사용**(별도 저장 위치 만들지 않음):
  즐겨찾기는 `toggleFavorite`(PATCH `/jobs/:id/favorite`)로 `isFavorite` 토글, 삭제는 `deleteJob`(DELETE `/jobs/:id`). 삭제 후 목록으로 복귀(`navigate(-1)`)
- 카드 전용 버튼은 카드 내부 절대배치·hover 노출을 전제하므로, 상세 헤더에선 `position: static`·상시 노출로 오버라이드
- 검증: `tsc --noEmit` 통과(에러 0)
- 수정: `frontend/src/pages/JobDetailPage.tsx`, `frontend/src/App.css`

## 2026-07-24

### "오늘 수집분" 날짜키를 로컬(KST) 기준으로 통일 — 매칭률 배치·추천 팝업 누락 수정
> 기록 : 08:55에 UPDATE 눌렀는데 매칭률 배치가 조용히 건너뛰어짐. 로그조차 안 남아서 처음엔 로그 유실인 줄 알았는데, 범인은 UTC였다. 09시 이전에 수집하면 하루 종일 "오늘"이 아니었던 것.
- 증상: 수집·평점 조회는 성공했는데 매칭률 조회 배치가 실행되지 않고 추천 팝업도 미노출. 관리자 배치 로그에 `매칭률조회` 행 자체가 없었음
- 원인: `new Date().toISOString().slice(0,10)`(UTC)로 "오늘"을 판정. KST(UTC+9)에서 08:55 수집분의 `collectedAt`은 `2026-07-23T23:55Z`(키 `07-23`)인데, 평점 조회가 3분 38초 걸려 09:00(=UTC 00:00)에 실행된 `countTargets()`의 키는 `07-24` → 대상 0건. 대상이 0이면 `runManualJob` 호출 전에 `return null` 하므로 실행 이력도 남지 않음(설계상 정상)
- 로컬 날짜키 헬퍼 신설(`localDateKey`/`todayLocalKey`/`isCollectedToday`) 후, 날짜를 판정하던 5곳이 단일 함수를 공유하도록 수정. `runLog.ts`에 있던 동일 로직 사설 `todayKey()`도 제거해 중복 해소
- `jobs.ts` 추천 팝업은 공고는 UTC·`sessionId`는 로컬 인라인 계산으로 기준이 섞여 있던 것을 로컬로 통일(인라인 날짜 계산 코드 삭제)
- 배치 대상 선별을 headless Claude가 수행하는 두 배치는 프롬프트가 "collectedAt의 ISO 날짜(앞 10자)"를 지시하고 있어 서버 필터만 고치면 CLI가 여전히 UTC로 골랐음 → 서버가 계산한 날짜키를 프롬프트에 주입하도록 변경
- 검증: 동일 데이터에서 대상 0건 → 14건. 매칭률 배치 재실행 success(04:18:52~04:29:34), 추천 팝업 2건(72%·74%) 정상 노출
- 신규: `backend/src/utils/date.ts`
- 수정: `backend/src/scheduler/matchCheckJob.ts`, `backend/src/scheduler/writeDocumentsJob.ts`, `backend/src/routes/jobs.ts`, `backend/src/data/store.ts`, `backend/src/scheduler/runLog.ts`

### 작업 이력 관리 문서(PROGRESS.md) 도입
- "현재 작업 중 / 다음 할 일 / 최근 완료 / 주요 결정" 4개 섹션으로 세션 간 작업 상태를 인계. 세션 시작 시 먼저 읽고, 주요 단계 완료 시 갱신
- CHANGELOG(변경 이력)·README(구조 설명)와 역할 분리
- 신규: `PROGRESS.md`
- 수정: `CLAUDE.md` (작업 이력 관리 절차 추가)

## 2026-07-23

### runLog 쓰기 경쟁 잔여 수정 — reconcileInterruptedRuns 뮤텍스 적용
- 07-06(ba54be5) withLog 큐 도입 때 빠졌던 `reconcileInterruptedRuns()`도 큐를 거치도록 수정.
  서버 기동 시 catch-up 배치의 기록 쓰기와 겹치면 낡은 스냅샷으로 덮어쓸 수 있던 마지막 경쟁 창 제거
- 파일: `backend/src/scheduler/runLog.ts`

### 매칭표 차트 파서 — 등급 열 자동 감지
- 매칭률 조회 배치가 4열 표(`| 구분 | 공고 요구 | 보유 여부 | 매칭도 |`)로 생성한 공고에서 차트가 깨지던 문제.
  헤더 행에서 `평가`/`매칭도` 열 위치를 찾아 등급을 읽도록 보강 (기존 3열 형식은 그대로 동작, 헤더 없으면 3열 간주)
- 파일: `frontend/src/components/MatchReport.tsx`

### README 현행화 — 수동 UPDATE 파이프라인·추천 팝업 반영
- §3에 수동 UPDATE 4단계(수집→평점→매칭률→추천 팝업) 흐름 추가, 사용자 흐름에 매칭표 차트 언급
- §4 컴포넌트 표에 `matchCheckJob.ts`·`MatchReport.tsx`·`RecommendationModal.tsx` 추가
- §5 AI 기능 위치에 매칭률 조회 배치(matchCheckJob) 추가
- 파일: `README.md`

### 서버 기동을 세션 독립(detached) 방식으로 전환
- Claude 세션 백그라운드 태스크로 서버를 띄우면 세션 이벤트(요청 중단 등)에 서버가 함께 종료됨 →
  `Start-Process` 독립 기동으로 전환, 콘솔 로그는 `%LOCALAPPDATA%\curryUP\server.log`로 리다이렉트
- 파일: `CLAUDE.md` (재시작 절차 갱신)

### 추천 공고 팝업 — 수동 업데이트 파이프라인 4단계 신설
> 기록 : 강조 공고카드 보는것도 귀찮아서 팝업으로 가시성,가독성 다 잡음 이래서 UI가 끊임없이 발전하나보다...
- UPDATE(수집→평점→매칭률) 완료 직후·대시보드 첫 접근 시, 오늘 수집분 중 종합 매칭률 70% 이상 공고를 중앙 레이어 팝업으로 제안
- 백엔드 `GET /jobs/recommendations`: 오늘(collectedAt ISO 날짜) 수집분 + `documents.matchReport` 종합 70%+ 필터, `/:id`보다 먼저 등록. `sessionId`(오늘 최근 수동 collect 실행 id)로 업데이트 세션 식별
- 프런트: 팝업 모달(회사명·직무명·매칭률 배지, 카드 클릭 시 상세를 새 탭으로, [X]/배경/ESC로 fade-out 닫기). 닫으면 `localStorage`에 sessionId를 dismiss 플래그로 저장해 같은 세션 내 새로고침 시 재노출 방지
- 신규: `frontend/src/components/RecommendationModal.tsx`
- 수정: `backend/src/routes/jobs.ts`, `backend/src/scheduler/runLog.ts`, `frontend/src/api/client.ts`, `frontend/src/pages/DashboardPage.tsx`, `frontend/src/App.css`

## 2026-07-16

### Ollama 문서 생성 코드 제거, 수동 실행 버튼을 Claude 배치로 전환
- 미사용 Ollama 문서 생성 파이프라인 전체 삭제 (`ai/` 9개 + `generateMissingDocuments` + `aiBatchJob`)
- 관리자 `POST /ai/run`을 Ollama(`runAiBatchNow`) 대신 Claude 문서 작성 배치(`runWriteDocumentsIfNeeded`)로 재지정, `GET /ai/status`도 `write-documents` 잡 검사로 변경 (재시작 가드가 실제 활성 배치를 보호)
- 프론트 관리자 버튼: `runAiBatch`→`runWriteDocsBatch`, 라벨 `문서 작성 배치 (Claude)`·`지금 문서 작성 (Claude)`
- `server.ts` 죽은 aiBatch 주석 정리, 미사용 `undici` 직접 의존성 제거
- 삭제: `backend/src/ai/*`(9개), `backend/src/pipeline/generateMissingDocuments.ts`, `backend/src/scheduler/aiBatchJob.ts`
- 수정: `backend/src/routes/admin.ts`, `backend/src/server.ts`, `backend/package.json`, `frontend/src/api/client.ts`, `frontend/src/pages/AdminBatchPage.tsx`

### README 정리 (Ollama 서술 제거·배치 시각 정정)
- 사전 요구사항의 Ollama→Claude 전환 안내 제거, 5장 AI 기능 서술을 Claude Code 헤드리스 배치 기준으로 재작성
- 스케줄러 표 `notify(08:00)`→`notify(09:30)` 정정, 6.2를 `00:00/23:00 분리`→`22:00 체이닝`으로 정정
- 파일: `README.md`

## 2026-07-14

### 대시보드 정렬·강조 및 고정 그리드 (커밋 dd59d6a)
- 즐겨찾기·매칭률 70% 이상 공고를 대시보드 상단으로 정렬, 해당 카드는 굵은 테두리로 강조
- 공고 그리드를 브레이크포인트별 고정 컬럼 수 + 고정 카드 높이로 변경
- 파일: `frontend/src/pages/DashboardPage.tsx`, `frontend/src/App.css`, `frontend/src/utils/matchReport.ts`, `frontend/src/pages/AdminBatchPage.tsx`

### 평점조회 배치 백엔드 체이닝 (커밋 dd59d6a)
- `/collect` 이후 평점조회를 백엔드에서 이어서 실행 — 브라우저 탭 새로고침·이동과 무관하게 항상 실행 (기존엔 브라우저 상태에 의존해 유실됨)
- writeDocumentsJob(Claude CLI)을 scrape+평점조회 뒤에 실행, scrape는 22:00로 이동
- Ollama 야간 AI 배치 비활성화, generateDocuments는 순차 실행
- `documents`에 `matchReport` 필드 추가
- 파일: `backend/src/routes/collect.ts`, `backend/src/routes/jobs.ts`, `backend/src/scheduler/ratingCheckJob.ts`, `backend/src/scheduler/scrapeJob.ts`, `backend/src/scheduler/writeDocumentsJob.ts`, `backend/src/ai/generateDocuments.ts`, `backend/src/server.ts`, `backend/src/types.ts`

### curryUP 브랜딩 (커밋 dd59d6a)
- 탭 타이틀 curryUP, 파비콘 `favicon-curryup.png` 적용
- 셋업 스크립트 정리: 사용하지 않는 `setup.bat`/`setup.ps1` 제거, README 갱신
- 파일: `frontend/index.html`, `frontend/public/favicon-curryup.png`, `README.md`, `backend/scripts/setup.bat`(삭제), `backend/scripts/setup.ps1`(삭제)

## 2026-07-13

### 매칭표(matchReport) 막대 차트 렌더링 (커밋 f3c6b59)
- `매칭률 사전 평가` 표를 파싱해 라벨 막대 차트로 표시 (등급→%·색상 매핑, 범위 등급은 평균, `-`는 신호 없음 처리)
- 공고 상세 진입 시 문서 탭 중 첫 번째(matchReport 우선)를 자동으로 연다
- 파일: `frontend/src/components/MatchReport.tsx`(신설), `frontend/src/pages/JobDetailPage.tsx`, `frontend/src/App.css`, `frontend/src/types.ts`

## 2026-07-09

### 문서 작성 배치를 Ollama LLM에서 Claude Code로 전환
> 기록 : Ollama LLM 너무 느리고 공고 1개당 5-10 넘게 생성 시간이 걸림 그조차고 일반 ai 보다 정확도가 떨어지는 단점으로 변경하기로 선택 

- 야간 Ollama AI 배치(aiBatchJob, 매일 23:00) 자동 스케줄·catch-up **비활성화** (관리자 페이지 수동 실행 버튼은 유지)
- Claude Code가 직접 실행하는 문서 작성 배치 신설 — 프롬프트 체계는 `.claude/skills/write-documents/SKILL.md` (로컬 전용, git 미추적)
  - KKK 전략(지원동기) · STAR-F 전략(직무 역량) · 인간화 리라이팅(금지어·단문 30%) · 시그니처 슬로건 · 자가 검증 체크리스트 · 회사 유형별 톤 조정
  - 대상 선정 규칙: 요구 연차가 프로필 ±2 초과인 공고는 제외·삭제 후보 보고
- `writeDocumentsJob` 신설: scrape → 평점조회 종료 후, 문서 없는 신규 공고·즐겨찾기 공고가 있으면 Claude CLI(headless)를 자동 실행. runLog에 기록되어 관리자 페이지에서 이력 확인 가능
- 1차 실행 완료: 즐겨찾기 공고 8건 문서 작성 (플레이웍스·메타존·에이피알·휴넷·아이도트·셀바스에이아이·아타드·무하유)

### 매칭표 (matchReport)
> 기록: ai 활용 시에 자동 제공 해주던 항목인데 추가해봤다. 단순 User 사용 시에 아주 편리해보임.
- `GeneratedDocuments`에 `matchReport` 필드 추가 — 매칭률 사전 평가표(자격요건/스택/담당업무/우대사항, 종합 %, 강점·갭 Top) + 지원 권장도
- 공고 상세 화면에 **매칭표 탭** 추가 (내용이 있는 탭만 노출)

### 배치 스케줄 개편
> 기록 : 여전히 ollama에 고통받고 있었음... 이걸로도 해결되지않았다고 함
- scrape 배치: 매일 00:00 → **매일 22:00**
- 평점조회 배치: scrape 종료 후 **무조건 이어서 실행**하도록 체이닝
- 배치 체인: `scrape(22:00) → ratingCheck → write-documents(조건부)` — 전 단계 runLog 기록

### 영구 삭제 공고 재수집 차단 (커밋 039bca0)
> 기록 : 어느 프젝에서도 문제되는 ㈜ (주) 처리 
- 영구 삭제 시 기업명+제목을 `purgedJobHistory.json`에 기록, 스크래핑 배치가 수집 직후 대조해 일치(AND 조건) 시 적재 제외
- `㈜` ↔ `(주)` 표기 정규화로 사이트 간 법인 표기 차이 흡수
- 숨김 상태 공고도 재수집 차단 (id 기준)
- 숨김 공고 22건 영구 삭제 처리, 요구 연차 초과(7년+) 드제이 공고 삭제

### 기타
- `jobPostings.json` JSON 문법 오류 수정 (잘못 입력된 문자)
- `.gitignore`/CLAUDE.md 금지 목록에 `purgedJobHistory.json` 추가
- 프로필 자격 사항 정리 (정보처리기사만 유지)

## 2026-07-08

- 개인 데이터 폴더·로컬 전용 파일 `.gitignore` 추가 (커밋 ca225c8): `polished/` 폴더, `.idea/`, `run_single_job.mts`, `setup.zip`
- CLAUDE.md 개인정보 보호 금지 목록 확장
- 자기소개서 리라이팅: `documents.coverLetter`가 있는 공고 21건을 다듬어 `backend/src/data/polished/jobPostings_rewriting_*.json`으로 저장 (상투 표현 제거, 결론 우선 배치, STAR 구조, 사실관계 유지)

## 2026-07-07
> 기록 : 잡플래닛 평점 조회를 연결하고 싶었는데 api로는 지원하지 않아 다른 방식을 사용하여 진행함 결과는 성공\
> 100% 정확도가 있지 않아 기업명 매칭 시 (+지역 )추가조건을 설정해줌 
- 기업 평점 조회 배치 신설, 대시보드에 평점 표시 (커밋 cee4abc)

## 2026-07-06

- 마감 임박 공고 필터링을 jobs 라우트에서 분리, 야간 배치에서도 실행 (커밋 b468415)
- runLog가 쓰기 경쟁으로 "running" 상태에 고착되는 버그 수정 (커밋 ba54be5)

## 2026-07-03

- AI 배치에서 마감 임박 공고 제외, 공고 삭제 시 생성 문서 정리 (커밋 fae83ac)

## 2026-07-02

- SKILL.md 기준 마감 임박 공고 자동 삭제, 회사 검색 추가 (커밋 d7c4d22)

## 2026-06-30
> 기록 : ollama가 너무 느리고 무거워서 고민 시작 됨... 서버 재시작해서 죽었다고 하는데 방지해도 죽었음
- AI 배치 실행 중 서버 재시작 방지 (커밋 84248b5)

## 2026-06-29

- 공고 즐겨찾기 기능 + 관리자 탭 추가 (커밋 f67e123)

## 2026-06-26

- 개인 데이터 파일 git 추적 제외, CLAUDE.md 개인정보 보호 규칙 추가 (커밋 4874a68)
- CLAUDE.md 신설: 서버 재시작 절차, 작업 범위 규칙 (커밋 00670dc, e67d6f9)
- 숨김 공고 일괄 영구 삭제 기능 (커밋 fc68bf4)
- D-0/D-1 마감 공고 수집·대시보드 제외 (커밋 01d05e2)
- 대시보드 페이지네이션 NaN 버그 수정 (커밋 97e9922)
- tsx watch가 데이터 파일 변경에 반응하지 않도록 수정 (커밋 c2108df)
- 공고 카드 삭제/복원 + 관리자 대시보드 관리 탭 (커밋 31ceefb)
- README 갱신 (커밋 25f8fca, 5c3df55)

## 2026-06-25

- 관리자 배치 진행 상황 페이지 + 실행 이력 추적, 스크래퍼 개선 (커밋 27e01f0)

## 2026-06-24

- 잡코리아 스크래퍼, D-day 정렬, 프로필 조회/수정 분리 (커밋 da4cbd9)

## 2026-06-22

- 프론트/백엔드 단일 서버 통합, AI 문서 생성을 야간 배치로 분리 (커밋 2f86786)

## 2026-06-19

- 최초 커밋: AI 채용공고 매칭 및 자기소개서 자동화 서비스 (커밋 6beeb4d)
- README 추가 (커밋 b7fdeb0)
