# PROGRESS

> 마지막 갱신: 2026-08-12

현재 무엇을 하는 중이고 다음에 뭘 할지 추적하는 문서. 세션 시작 시 이 파일을 먼저 읽는다.
(변경 이력 자체는 `CHANGELOG.md`, 구조 설명은 `README.md`가 담당한다.)

## 현재 작업 중

- (없음)

### 2026-08-12 — 프로필 경력·학력 상세 입력 폼 개편 (구조화 스키마)

- 단순 텍스트(`careerHistory`·`education`)를 구조화 스키마로 개편. **텍스트 필드는 삭제하지 않고 파생 저장**(문서 배치 §8 호환, 결정 C).
- 스키마: `UserProfile`에 `careerInfo{totalExperience, careers[]}`·`educationInfo{highestLevel, educations[]}` 추가(백·프론트 `types.ts`).
- 신규 파일: `data/profileFormMeta.ts`(드롭다운 옵션), `utils/profileDerive.ts`(총경력 계산·YYYYMM 검증·byte 카운터·텍스트 직렬화),
  `components/CareerForm.tsx`, `components/EducationForm.tsx`, `components/JobTitlePicker.tsx`(택소노미 재사용 직무 팝업, 결정 A).
- 경력: 총경력 뱃지 자동계산 · 회사명(검색아이콘 UI만) · 입사/재직년월(YYYYMM) · 재직중 토글 · 직무 팝업 · 부서 · 직급 드롭다운 · 담당업무+byte 카운터. "+ 경력 추가". **인증경력 불러오기는 미구현(결정 A).**
- 학력: 1단계 구분 드롭다운 → 구분별 동적 필드(초/중=최소, 고교=검정고시·편입·전공계열, 대학=구분/전공/학점·추가전공·주야간 동적추가, 기타=인정학력/전공분야/지역). 구분 변경 시 이전값 reset.
- `yearsOfExperience`는 경력 카드에서 **파생**(반올림, 결정 B). 카드 0개면 레거시 년차 유지 → 기존 프로필 저장 안 막힘.
- `ProfileEditPage` 유효성 검사(필수·YYYYMM 6자리·재직년월≥입사년월, 실패 시 해당 fieldset 포커스). `ProfileViewPage` 경력 요약=총경력.
- 백·프론트 `tsc --noEmit` 통과. **미검증**: 4000 화면 실제 렌더·저장·재조회 라이브 확인.

#### UI 개편 (2차, 같은 날) — PRD 반영
- 공통 컴포넌트 신설: `CardHeader`(번호뱃지+요약+접기+삭제), `PeriodRange`(시작–종료+진행중+자동기간, 경력·학력 공용), `FieldLabel`(필수=도트 / 선택="(선택)").
- 섹션 헤더: `*`→"필수" 텍스트 뱃지, 총경력 pill 축소("총 N개월"), "+ 추가" 버튼 우측 solid navy.
- 카드: surface-2 배경 + surface 헤더(번호 22px·요약 노출·접기 ⌃)·본문 분리. 접기 상태(첫 항목 펼침/추가시 펼침).
- 경력 본문 4행 재배치(회사명·직무 / 근무기간(PeriodRange) / 부서·직급 / 담당업무). 담당업무 카운터 "N/2,000자"(byte 제거·하드 상한 2,000), 헬퍼 문구.
- 학력: 재학기간 PeriodRange 통일, 추가정보(학점·추가전공·주야간) solid 버튼+구분선 그룹화. **학력 구분은 드롭다운 현상 유지(Q1 (b))**.
- 토큰: `--req`·`--field` 신규 추가(라이트/다크). **전역 토큰 불변(Q2 (a))** — 폼 스코프만.
- 입력 높이 40px·본문 13px 통일. 프론트 `tsc --noEmit` 통과.

### 2026-08-12 — 희망 직무 카테고리 전 업종 확장 (사람인 분류 기반) + 상세 펼치기

- 사람인 `job-category` 페이지의 `job_category_section`(searchPanelArgs.options.job_category)을 긁어와
  **공식 직무 대분류 21개 / 세부직무 667개** 확보(scratchpad `jc.json`).
- `jobCategoryMeta.ts` 재구성: 그룹 21개, 각 그룹에 `categories`(대표 직무, 공고많은순 상위 8개·IT는 기존 12개 라벨 유지) +
  `detail`(사람인 세부직무 전체) 2단 구조. `RoleCategoryGroup` 인터페이스 추가.
- `JobCategoryPicker.tsx`: 그룹 탭 안에 **"+ 상세 직무 전체 보기" 토글** 추가 — 대표 직무는 기본 노출,
  상세는 접힘/펼침. 접힌 상태에서 상세 선택 개수 배지 표시. 대표에 이미 있는 라벨은 상세에서 제외(중복 방지).
- `ROLE_QUESTIONS`(frontend `types.ts`) 167개로 확장 — 대표 직무별 그룹 질문(IT는 기존 개별 질문 유지).
  `CATEGORY_SKILL_HINTS`도 대표 직무에 그룹 힌트 부여.
- 선택값은 대표·상세 모두 `desiredRoleCategories`에 라벨 그대로 저장 → 매칭(rootKeyword 첫 단어) 그대로 작동.
- 프런트 `tsc --noEmit` 통과. **미검증**: 4000 화면에서 21개 탭·상세 펼치기 실제 렌더 라이브 확인.
- 주의(미처리): 구 비IT 라벨(영업/세일즈·인사/HR·재무/회계·고객지원/CS·운영/오퍼레이션·기획/PM·UX/UI 디자인·
  그래픽/브랜드 디자인)은 새 택소노미에서 빠짐 → 그 라벨을 이미 저장한 프로필은 매칭에서 붕뜰 수 있음.
  IT 라벨은 보존. 비IT 공고 매칭은 스크래퍼가 해당 카테고리로 수집·분류해야 실효(별도 작업).

## 다음 할 일

- 실제 메일 발송 후 회원가입 흐름 최종 확인(SMTP 연결됨, seed 계정은 인증 완료)
- 레거시 단일 파일(`userProfile.json` 등)은 백업으로 보존 중 — 안정화 확인 후 제거 여부 결정
- (관찰) 문서작성 배치가 headless `claude` CLI 일시 오류(exit 1)로 간헐 실패 — 스케줄 실행은 성공. 재현 잦으면 원인 조사

- 09:00 KST 경계(00:00~09:00 사이 수집분) 매칭률 배치 누락 방지 수정의 실제 경계 통과 검증은 아직 미실시 — 그 시간대 UPDATE 실행 시 확인 (07-28 10:09 KST 실행분은 경계를 지나지 않아 검증 대상 아님)
- `문서 작성 배치`(write-documents)도 같은 날짜키 수정이 적용됐으나 아직 실행 검증 전 — 다음 실행 때 대상 건수 확인

- **[내일(2026-08-07) 체크] 배치 재실행(재배치) 기능 라이브 검증** — 오늘 밤 스케줄 배치(scrape 20:00 / write-documents 21:00, 그리고 09:00·19:00)가 모두 정상 실행됐는지 먼저 확인. 실패가 발생했다면 5분 뒤 자동 재실행 + 더블 실패 OS 알림이 실제로 동작했는지 관찰(5분 지연 특성상 라이브 실측 전). 전부 성공이면 재시도 경로는 트리거되지 않으므로 "성공만 확인"으로 종결.

## 최근 완료

### 2026-08-11 — 공고 상세: 탭별 문서 직접 생성(온디맨드) + 관리자 배치 row 통합

- **탭별 즉시 생성**: 상세 페이지에서 문서 탭 4개(매칭표·자기소개서·소개·경력사항)를 내용 없어도 항상 노출.
  빈 탭 중앙 "○○ 생성" 버튼 → 클릭 시 해당 공고 1건·해당 필드 1개만 Claude CLI headless로 생성 →
  "생성 중..."(버튼 disabled) → 완료 시 공고 재조회 후 렌더. 요청 탭만 단독 생성하되 그 탭의 하위 항목은 전부 작성.
- 저장 위치는 기존 `documents.{docType}` 재사용(새 필드·새 저장소 없음). 동시 실행은 막고 안내(409 BUSY —
  단일 생성 진행 중 또는 야간 문서/매칭 배치 running이면 차단). 상태 폴링으로 완료·실패 판정.
- 신규: `backend/src/scheduler/singleDocJob.ts`, 라우트 `POST/GET /api/jobs/:id/documents/:docType/generate|status`
  (`routes/jobs.ts`), api client `generateJobDocument`·`fetchJobDocStatus`, 프런트 `JobDetailPage.tsx`·`App.css`(.doc-generate).
  runLog는 `문서생성:{라벨}` 이름으로 남김(runManualJob 재사용 → 실패 처리·이력 공유).
- **관리자 배치 페이지**: "지금 종료 점검" 버튼을 "공고 수집 배치" row로 통합, 라벨 "공고 수집 / 종료 점검"(`AdminBatchPage.tsx`).
- 부수: `scrapeJob.ts:14` import 뒤 stray 텍스트(`admin-status`) 제거 — 백엔드 컴파일 복구.
- 백엔드·프런트 `tsc --noEmit` 통과. 프런트 빌드 + 백엔드 재시작 완료 — 신규 라우트/UI **라이브 반영**(4000).
  - 서버는 dev 모드(`NODE_ENV!=production`)라 Vite 미들웨어로 `src`를 실시간 서빙한다(재시작 중 PID 회전·HMR 로그는 정상). kill 대상은 `node.exe`로 한정할 것(powershell 셸 자기kill 방지). → 메모리 [[project-dev-server-vite-middleware]]·[[feedback-server-restart]].
  - **미실시**: 실제 생성 버튼 클릭 → Claude CLI 생성 완료까지의 end-to-end 라이브 검증(수 분 소요라 다음 기회에 관찰).

### 2026-08-06 — 배치 실패 시 자동 재실행(재배치) + 더블 실패 OS 알림

- 모든 스케줄 배치(notify 09:00 · closed-check 19:00 · scrape 20:00 · write-documents 21:00)가 실패하면 5분 뒤 1회 자동 재실행. 성공·정상 스킵(대상 없음)은 재시도 안 함.
- 원본·재시도 모두 실패(더블 실패) 시 OS 알림 통지 — notify가 쓰는 `notifyWithLink`(osNotifier) 재사용, 문구만 실패용으로 변경. 대시보드 토스트·recommendations 필드·새 저장소는 만들지 않음.
- 공용 래퍼 `withScheduledRetry(jobName, run)` 신설, 반환된 `RunRecord.status`로 실패 판정. 4개 배치 cron 핸들러에만 적용(수동·catch-up 제외). 재시도도 스케줄 실행 레코드로 runLog에 남아 관리자 이력에서 보임.
- 신규 `backend/src/scheduler/scheduledRetry.ts`, 수정 `scrapeJob.ts`·`notifyJob.ts`·`closedCheckJob.ts`·`writeDocumentsJob.ts`. `tsc --noEmit` 통과.
- 한계: 재시도는 인메모리 `setTimeout`이라 5분 대기 중 서버 재시작 시 유실(실패 발생 시에만 해당). **라이브 검증은 위 "다음 할 일"로 이월.**

### 2026-08-06 — 배치 스케줄 저녁 이동 + 추천 팝업 스케줄 대응

- 스크래핑 체인 07:00→20:00(`scrapeJob.ts`), 문서 작성 08:00→21:00(`writeDocumentsJob.ts`). notify(09:00)·closed-check(19:00)는 유지. README 스케줄 표기 전면 갱신 + §3에 배치 스케줄표 추가.
- 추천 공고 팝업 `sessionId`를 manual `collect` 전용 → 오늘 수집 파이프라인(`collect` 또는 `scrape`)의 최신 실행으로 확장(`routes/jobs.ts`) — 스케줄 scrape만 돈 날에도 팝업이 뜨도록 수정.

### 2026-08-04 — 공고 상세 페이지 매칭표 리디자인 (리포트/스탬프 감성)

- 범위 = 비주얼(CSS/마크업)만. 기존 로컬 폰트·OKLCH 토큰·매칭표 클래스 재사용(외부 CDN 폰트·새 변수 세트·컴포넌트 개편 안 함). 종이 질감 토큰 `--paper`만 최소 신규.
- 매칭표 카드: 종이색 배경 + 점선 테두리 + 좌측 앰버 스티치(`::before`), 종합 점수를 회전 원형 도장 스탬프(`.match-stamp`, 색 티어는 `matchTier` 재사용), 게이지 바 18→6px.
- 평가 항목 고추: 등급 **앞 글자** 기준(강 🌶️×3 / 중·중강·중상·중약 🌶️×2 / 약·하 🌶️×1 / 없음·무 0). 게이지 채움 폭은 세부 pct 유지.
- 원본 공고 링크: 텍스트 → 아웃라인 버튼(hover 앰버 채움), 근무지 `<p>`와 한 줄(`.job-detail-meta` flex, 좌 근무지·우 버튼). 상세 카드 780px/40px, h2 마진 `5px 0 8px`.
- 하드코딩 색 토큰화로 매칭표 다크모드 정상화. 수정: `frontend/src/index.css`, `App.css`, `components/MatchReport.tsx`, `pages/JobDetailPage.tsx`. `tsc --noEmit`·빌드 통과.
- **미실시**: 파싱 로직성 항목(약점 섹션 `.section.weak` 분리, 게이지 3단 고정)은 범위 밖으로 제외. 커밋은 아직 안 함.

### 2026-08-04 — 종료 공고 점검 배치(매일 19시) + 기존 공고 postingBody 백필 자동화

- **종료 공고 배치**: 매일 19:00 cron으로 수집 공고의 진행중/종료를 사이트에서 확인해 종료분만 `disabled` 표시. 오탐 방지로 unknown·진행중은 유지, 자동 삭제 안 함(카드 ✕로 수동 삭제). 스크레이퍼별 `checkPostingStatus`(사람인 404 / 잡코 5xx·본문없음) 실측 4/4 통과. 관리자 배치로그 행 토글로 종료 목록 확인 + "지금 종료 점검" 수동 버튼. 종료 공고는 추천·백필에서 제외.
- **postingBody 백필**: 사람인 `fetchPostingBody` 도입 이전 수집분(본문 없음)을 UPDATE 말미 백필 패스로 채움(자기 종료형). 일회성 34건 채움 + 재시작 대조군 검증 완료.
- 백엔드·프런트 `tsc --noEmit` 통과. 상세 파일 목록은 `CHANGELOG.md` 2026-08-04 참조.
- **미실시(다음 할 일)**: 종료공고 배치 라이브 첫 실행(19시 스케줄 또는 관리자 수동)으로 실제 마감 공고 disabled·토글·카드 흐림 end-to-end 확인. 현재 구동 서버는 이전 코드라 재시작 필요.

### 2026-08-03 — 대시보드 UI 손질 + 워드마크 홈 링크 (커밋·push 완료)

- 대시보드 하단 "총 N개" 푸터 추가 후 pagination 줄 가장 우측으로 정렬(컨트롤은 중앙 유지, 페이지 1개일 때도 카운트 노출). 다크모드 추천 모달 배경을 배경보다 밝게·추천 카드 기본 테두리 흰색. TopBar 워드마크(curryUP)를 홈("/"=대시보드) 링크로 감쌈.
- 07-30 미커밋 작업(SKILL 경로 정합·seed 템플릿·CLAUDE.md 말투/포트 규칙)까지 4개 커밋으로 정리해 `origin/master` push 완료(`1a1e995`·`25dacf2`·`a5f4ddb`·`c02f492`).
- 수정: `frontend/src/pages/DashboardPage.tsx`, `frontend/src/App.tsx`, `frontend/src/App.css`.

### 2026-07-30 — 프로필 seed 값 채우기 완료 (선택필드 2개 입력)

- 라이브 프로필(`profiles/usr_1785226110609.json`)은 07-28 마이그레이션 때 이미 실제 값으로 대부분 채워져 있었음(경력 4년차·희망직무·근무지·스킬·자격증·경력사항·선택필드 대다수). `.example.json`의 마스킹 플레이스홀더는 커밋용 템플릿이라 그대로 유지가 정상.
- 실제로 비어 있던 선택필드 2개만 `/profile/edit`(4000)에서 직접 입력·저장: `sideProjects`="사이드프로젝트", `learningStack`="바이브코딩, react". `PUT → profiles/{userId}.json` 반영, `lastProfileUpdate` 2026-07-30 갱신 확인.

### 2026-07-30 — write-documents SKILL 경로 정합 + 프로필 seed 템플릿 + 파이프라인 검증

- **SKILL 레거시 경로 정리**: `.claude/skills/write-documents/SKILL.md`가 §1·§2·§2-3·§3-3·§5·§8 등 8곳에서 레거시 단일 파일(`jobPostings.json`·`userProfile.json`)을 가리키던 것을 **"실행 시 주입된 대상/프로필 파일"(멀티테넌트 `jobPostings/{userId}.json`·`profiles/{userId}.json`)** 로 교체 + "레거시 읽지 말 것" 명시. `writeDocumentsJob.ts`가 프롬프트로 주입하는 per-user 경로와 지시가 이제 한 방향(모순 제거 — 남의 프로필로 자소서 쓰거나 산출물을 레거시 파일로 흘릴 위험 차단).
- **프로필 seed 템플릿 작성**: draft(중첩 `applicant.profile`) 예시 → 라이브 평평 `UserProfile` 스키마로 변환해 `backend/src/data/userProfile.example.json` 생성(레거시/실데이터 미덮어씀). `career[]→careerHistory`(문자열), `certs→certifications`, `narrative+signature.closing→careerNarrative`, `signature.phrase→slogan`, `results(verified:false)→representativeMetrics`("약" 완화, §7). `isProfileConfigured` 통과 검증 완료.
- **스키마 결정**: 평평 스키마 유지(중첩 개편 안 함 — types/store/profile.ts/프론트 폼/SKILL §8/마이그레이션 대공사 회피).
- **파이프라인 완결 검증(코드 무변경)**: "저장 시 파일 생성/갱신 배치"는 이미 존재 — `PUT /api/profile → saveProfile → profiles/{userId}.json`. `ProfileEditPage.tsx`에 선택 필드 9개(`sideProjects`·`learningStack`·`aiToolUsage`·`slogan`·`careerNarrative`·`education`·`careerDirection`·`interestDomains`·`representativeMetrics`) **이미 전부 구현·배선**됨 → 폼 확장/신규 배치 불필요. 남은 실제 작업은 값 채우기뿐(위 "현재 작업 중").

### 2026-07-30 — FE 리디자인 전 화면 완료 (대시보드→프로필→로그인→상세·관리자)

- 화면별 절차(①rollback→②변경→③확인→④commit)대로 전 화면 완료. 범위 = layout/ui/color, 백엔드/로직 무변경.
- 공통 시스템: OKLCH 디자인 토큰(라이트/다크) + 테마 토글, 앰버 accent, 매칭률 링 3티어(**hi≥70 초록 / mid 60~70 네이비 / lo<60 회색**, 판정 단일함수 `utils/matchTier.ts`), 버튼 대비 수정(`#fff`→`--accent-ink`), 라이트 `--accent-bg`/`--accent-border` 네이비→앰버 틴트 교정.
- 화면별: 대시보드(TopBar·FilterRail·매칭링 카드·오늘/강조 box-shadow 구분·D-day 앰버 통일), 프로필(보기=surface 카드 / 편집 폼·커스텀 컴포넌트 TagInput·LocationPicker·JobCategoryPicker 톤 통일), 로그인(배경 `--navy`→`--bg`·surface 카드·워드마크 제목), 공고상세(surface 카드), 관리자(배치 버튼 solid primary·컨트롤 행 카드·테이블 헤더 폴리시).
- 폰트 한계: NanumSquareNeo가 Regular(400)/Bold(700)만 있어 800+는 렌더 700이 최대(`font-synthesis:none`) → 제목·워드마크는 `-webkit-text-stroke`로 굵기 보완.
- 커밋: 대시보드 `a1f6b1a` / 프로필 `ac5c243` / 로그인 `dbf388a` / 워드마크 `5e9b59c` / 상세·관리자 `f7e65be`. (선행 멀티테넌트·인증·문서 pending은 `bc46412`~`5de9abd` 4개 커밋으로 분리 정리.)

### 2026-07-29 — 수동 UPDATE 실행 + 오늘 카드 스타일 검증

- `POST /api/collect` 608건 수집 / 신규 매칭 2, 평점조회→매칭률조회 순차 성공. 매칭률조회(headless Claude)가 오늘 수집분 4건에 matchReport 정상 작성 → "문서/매칭 배치 간헐 exit1" 우려는 이번 실행에선 재현 안 됨(성공).
- 오늘 수집분 4건 매칭률 54~64%(전부 <70) → "오늘 카드"(오늘 수집 + ≥70%) 0건이 설계상 정상. 카드 스타일 확인용으로 추천 임계값(`jobs.ts`)을 임시 70→60 후 원복·재시작.

### 2026-07-28 — 멀티테넌트 이메일 인증 + seed 계정 데이터 마이그레이션 (실행 완료)

- 이메일 인증(링크) 실제 SMTP 발송 연결(Gmail 앱 비밀번호, `backend/.env`). 인증 링크 base URL = LAN IP(`192.168.110.160:4000`)라 같은 네트워크 폰에서도 인증 가능. SMTP verify 성공.
- seed 계정 `hyeonpaaark@gmail.com`(`usr_1785226110609`, verified)으로 레거시 단일 파일 → 유저별 파일 이관 완료: 프로필(4년차·필수값 충족), 공고 88건(전부 매칭표), 즐겨찾기 2·숨김 37, purged/runLog, polished 산출물. 레거시 원본은 백업 보존.
- 테스트 계정 전부 삭제(`users.json` 정리 후 seed 1개).
- **배치 시퀀스 검증 완료**: UPDATE(collect 607건·신규 2)→평점조회→매칭률조회 전부 성공, 유저별 파일(`jobPostings/`·`runLog/{userId}.json`)에 정상 기록. 21:00 KST 스케줄 cron도 seed 유저로 자동 실행 확인. 문서작성은 수동 1회 CLI 실패(exit 1)·스케줄 1회 성공 → 일시 오류로 판단.

### 2026-07-28 — 이메일 로그인 + 유저별 파일 격리(멀티테넌트) 전환 (코드)

- 단일 유저 → 이메일/비밀번호 로그인 멀티테넌트. auth(signup/login/me, JWT, bcryptjs), store.ts 유저별 파일(`{userId}.json`) 격리, runLog도 유저별.
- 배치 대상 = "가장 최근 로그인 + 프로필 충족" 유저 1명(`getBatchUserId`). 스케줄 cron은 이 유저, 수동 트리거는 로그인 유저.
- 프런트: 토큰 localStorage, Authorization 헤더, `AuthProvider`+`/me` 라우트 가드, 로그인/회원가입 페이지, 프로필 없으면 `/profile/setup` 강제.
- 백엔드·프런트 `tsc --noEmit` 통과. 상세 결정은 [[project_multitenant_auth]] 메모리 참조. (마이그레이션은 위 "현재 작업 중")

### 2026-07-28 — 프로필 필수값 미작성 시 배치 실행 차단 + 편집 validation

- 필수값 = **희망 직무 카테고리 ≥1 + 경력(년차)**. 이 값이 실제로 채워졌는지로 판정(저장 여부 `lastProfileUpdate` 아님). 미작성이면 공고 스크래핑·매칭률 조회·문서 작성 배치와 대시보드 UPDATE 수집을 실행하지 않음. 오전 프로필 알림 배치(notify)는 제외.
- 프런트 배치 버튼 클릭 시 미작성이면 `"프로필을 먼저 작성해주세요."` alert 후 `navigate("/profile")` 이동. 백엔드도 프런트 우회·자동 스케줄 대비 이중 가드(collect·scrape/run 라우트 400, scrapeTask·matchCheck·writeDocuments 스케줄 skip).
- 프로필 편집(`/profile/edit`) 저장 시 필수값 validation 추가(미입력 저장 차단·라벨 `*`), 백엔드 `PUT /api/profile`도 동일 필수값 400 방어.
- 판정 규칙 단일 함수 공유: 백엔드 `store.isProfileConfigured`/`hasProfile`, 프런트 `utils/profileGuard.isProfileConfigured`/`ensureProfileOrRedirect`.
- 백엔드·프런트 `tsc --noEmit` 통과.

### 2026-07-28 — 미수집 백엔드 공고 11건 수동 편입 + 매칭률 평가

- 사용자가 붙여넣은 백엔드/Java 공고 중 크롤 검색어(백엔드·풀스택)에 안 걸려 미수집이던 11건을, 회사명으로 사람인 검색해 해당 공고를 특정 후 `jobPostings.json`에 편입(프로필 `isMatch` 필터는 사용자 명시 요청으로 우회).
- 스크래퍼 재사용(`SaraminScraper.fetchPostings`)으로 sourceUrl·스킬·마감·연차 확보. 초기 2건(보이스토어→'솔루션 엔지니어', 곳간로지스→'전략영업매니저')이 동명 다른 공고로 잘못 잡혀 제거 후 올바른 개발 공고로 교체.
- 11건 §6-1/6-2 평가표 작성해 `documents.matchReport` 저장. 결과: 에스제이소프트텍 76 / 린인파트너스 76 / 타이드플로 75 / 보이스토어 74 / 상상스토리 72 / 보나네트웍스 68 / 석세스모드 68 / 곳간로지스 66 / 에이아이콴텍 66 / 럭스미스 64 / 이지서티 64.
- collectedAt이 오늘이라 70%+ 5건(에스제이·린인·타이드플로·보이스토어·상상스토리)은 당일 추천 팝업 대상에도 포함됨. 단 상상스토리(D-0)·보이스토어(D-1)·석세스모드(D-2)는 서버 만료/임박 정리로 곧 제거될 수 있음.
- 이번 작업 중 서버가 과거마감 2건을 정상 정리(총 89→편입 후 98). 스크래퍼는 상세 본문을 긁지 않아 description은 스킬칩 수준(기존 사람인 수집분과 동일).

### 2026-07-28 — 매칭률 미평가 공고 15건 일괄 평가 + 통합 TOP 10

- 배경: 매칭률조회 배치는 "오늘 수집분"만 대상으로 삼아, 07-14~07-22 수집된 백엔드 공고 15건이 `documents.matchReport` 없이 남아 있었음.
- Claude(현 세션)가 SKILL §6-1/6-2 형식으로 15건 평가표를 직접 작성해 `documents.matchReport`에 병합 저장(기존 필드·형식 재사용, 신규 저장위치 없음). 저장 후 89건 전체가 파싱 가능(누락 0).
- 붙여넣은 14건(보안·임베디드·HW·로보틱스)은 `jobPostings.json`에 없고 제목만 있어 **제목 기반 추정치로 보고만** 하고 미저장(필터 우회·재스크랩은 미실시). 전부 42% 이하로 TOP 10 밖.
- 통합 TOP 10(신규 평가 15+14 중): 위즈커뮤니케이션 82 / 아이파트너즈 78 / 동화세상에듀코 73 / 캐롯아이 72 / 플레이웍스 70 / 시스템노바 68 / 아이티원 66 / 벨로크 64 / 템프인 63 / 마크베이스 62.
- 참고: 전체 89건 기준 상위는 휴먼컨설팅그룹 84 / 위즈커뮤니케이션 82 / 홀빅 80 순.

### 2026-07-28 — 수동 UPDATE 실행 (10:09 KST)

- `POST /api/collect`: 수집 601건 / 신규 매칭 0건. 이어서 평점조회 success(01:10~01:17Z).
- `매칭률조회`는 대상 0건으로 건너뜀 — 당일(07-28) 매칭 공고는 오전 08:53 KST 실행분에서 이미 matchReport 보유.
- 사용자가 붙여넣은 신규 공고(펜타시큐리티·컴레이저·우리엔·플라잎·쏠리드윈텍·세온이앤에스 등 보안/임베디드/HW/로보틱스 직군)는
  백엔드 개발자 프로필과 `isMatch` 불일치로 수집 후 필터링됨 → 카드 미생성·매칭률 미산출(설계상 정상, `runScrapeAndMatch.ts:62`).
- 추천 팝업(오늘 수집분 종합 70%+) 2건: (주)하솜정보기술 72%, (주)이파피루스 70%.

### 2026-07-27 — 공고 상세 페이지 즐겨찾기·삭제 버튼 추가

- 상세 페이지 상단에 삭제(`×`) → 즐겨찾기(`☆/★`) → 목록으로 순 액션 헤더(`.job-detail-header`) 신설.
- 둘 다 대시보드 카드와 **같은 엔드포인트·같은 필드 재사용**: 즐겨찾기 `toggleFavorite`(`isFavorite`),
  삭제 `deleteJob`. 별도 저장 위치를 만들지 않아 목록과 통합 관리됨. 삭제 후 목록 복귀(`navigate(-1)`).
- 수정: `frontend/src/pages/JobDetailPage.tsx`, `frontend/src/App.css`. `tsc --noEmit` 통과.

### 2026-07-27 — 수동 UPDATE 실행

- 서버 기동 후 `POST /api/collect` 실행: 수집 606건 / 신규 매칭 9건, 이어서 평점조회 success.
- 후속 `매칭률조회` 배치는 실행 시작(running)까지 확인했으나, 폴링을 중단해 **최종 완료 상태는 미확인**(위 다음 할 일 참조).

### 2026-07-24 — "오늘 수집분" 날짜키를 로컬 기준으로 통일

- **증상**: 08:55에 UPDATE 실행 → 수집·평점 조회는 성공했는데 매칭률 조회 배치가 실행되지 않았고,
  추천 공고 팝업도 뜨지 않음. 관리자 배치 로그에도 `매칭률조회` 행이 없었음.
- **원인**: `new Date().toISOString().slice(0,10)`(UTC)로 "오늘"을 판정. KST는 UTC+9라
  08:55 수집분의 `collectedAt`은 `2026-07-23T23:55Z`(키 `07-23`)인데, 평점 조회가 3분 38초 걸려
  09:00(=UTC 00:00)에 실행된 `countTargets()`의 키는 `07-24` → 대상 0건으로 건너뜀.
  대상이 0이면 `runManualJob`을 호출하기 전에 `return null` 하므로 로그도 남지 않음(정상 동작).
- **조치**: `backend/src/utils/date.ts` 신설(`localDateKey`/`todayLocalKey`/`isCollectedToday`),
  판정하던 5곳이 공유하도록 수정. Claude CLI 프롬프트에도 서버가 계산한 날짜키를 주입.
- **검증**: 같은 데이터에서 대상 0건 → 14건. 배치 재실행 success(04:18:52~04:29:34),
  추천 팝업 2건((주)디지캡 72%, (주)퍼즐데이터 74%) 정상 노출.

## 주요 결정

- **2026-07-24 · "오늘" 판정은 로컬(KST) 날짜 기준으로 통일한다.**
  `collectedAt`은 UTC ISO로 저장하되, 날짜 비교는 반드시 `utils/date.ts`를 거친다.
  ISO 문자열 앞 10자를 그대로 자르는 방식은 00:00~09:00 수집분을 하루 종일 누락시킨다.
  배치 대상 선별을 headless Claude가 수행하는 경우(매칭률 조회·문서 작성)에도
  프롬프트에 서버가 계산한 날짜키를 문자열로 주입해 CLI 쪽이 UTC로 판정하지 않게 한다.
- **2026-07-24 · 매칭률은 `documents.matchReport` 한 곳에만 쌓는다.**
  수동(UPDATE)이든 자동(스케줄)이든 같은 필드·같은 파일(`jobPostings.json`)에 쓴다.
  트리거 시점만 다를 뿐 저장 위치는 동일하다. (`CLAUDE.md` 기존 구조 재사용 원칙과 동일 맥락)
