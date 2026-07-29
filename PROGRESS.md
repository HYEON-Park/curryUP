# PROGRESS

> 마지막 갱신: 2026-07-29

현재 무엇을 하는 중이고 다음에 뭘 할지 추적하는 문서. 세션 시작 시 이 파일을 먼저 읽는다.
(변경 이력 자체는 `CHANGELOG.md`, 구조 설명은 `README.md`가 담당한다.)

## 현재 작업 중

### FE 리디자인 — 1단계: 대시보드 (코드 완료, 확인 중 / 아직 commit 안 함)

- 진행 절차(사용자 지정, 화면마다 반복): **① rollback 시점 → ② FE 변경 → ③ 서버에서 확인 → ④ 적용(commit)**.
  화면 순서: **대시보드 → 프로필 → 로그인**. 범위 = **layout/ui/color 위주**(백엔드 미변경).
- 현재 대시보드 ②까지 완료, **③ 확인 중**. commit(④) 미실시.
- **rollback 시점**: `git stash create` SHA `274a13c` → 복원 `git checkout 274a13c -- frontend/`.
  추가 백업: scratchpad `fe-rollback-dashboard/`(세션 종료 시 사라질 수 있으니 재개 시 git 스냅샷 사용).
- **신규 파일**: `frontend/src/utils/matchTier.ts`(매칭률→티어 hi≥85/mid60-84/lo<60 단일 판정),
  `hooks/useTheme.ts`(data-theme 라이트/다크 토글+localStorage), `hooks/useJobFilters.ts`(검색+지역+매칭률 threshold AND 필터, 실제 JobPosting 필드 매핑),
  `components/MatchRingBadge.tsx`(40×40 매칭률 링), `components/JobCard.tsx`(링+하단 ★/✕), `components/FilterRail.tsx`(지역·매칭률 셀렉트).
- **수정 파일**: `index.css`(OKLCH 토큰 라이트/다크 + 레거시 변수 alias, #root full-width, 워드마크 폰트 변수),
  `App.tsx`(TopBar: 워드마크 curry/UP + 탭 + 테마토글 + 이메일/로그아웃, 테마 최상위 관리),
  `App.css`(TopBar/FilterRail/검색행/카드+매칭링/텍스트형 페이지네이션 + 모바일 반응형),
  `pages/DashboardPage.tsx`(Shell=FilterRail+Main, 클라이언트 필터·페이지네이션, 공고 전체 로드).
- 사용자 조정 반영: 그리드 3×4 고정, 콘텐츠 좌우 패딩 27px, FilterRail 폭 `clamp(240px,20vw,340px)`,
  하이브리드(앱 웹뷰) 대응 — ≤768px에서 FilterRail 상단 가로 바로 접기 + TopBar 축약, ≤480px 추가 축약.
- `tsc -b` 통과. dev 서버 기동 상태(백엔드 :4000 단일 포트 — Vite가 `middlewareMode`로 Express에 붙어 프런트·API를 함께 서빙, 별도 5173 없음. `server.ts:52-58`).

#### 다음 재개 시 (이 리디자인)

- **③ 확인 미완**: 앱 웹뷰에서 대시보드 최종 확인 → OK면 **④ commit**(개인정보 파일 staging 제외 확인).
- **알려진 부수효과/미결**:
  - 토큰이 전역이라 아직 리디자인 안 한 **프로필·로그인·상세·관리자 화면도 색이 바뀜**. 레거시 primary 버튼이 amber accent 위 흰 글씨라 대비 약할 수 있음 → 각 화면 단계에서 정리.
  - **폰트**: Manrope/Noto Sans KR 파일 없어 시스템 폴백만. 실물 폰트 필요 시 `public/fonts`에 추가 후 @font-face.
  - 그리드는 셸 full-width라 가이드의 `repeat(3,1fr)` 대신 3×4 고정 + ≤900 2열 / ≤600 1열.
  - 프로필/로그인/상세 화면은 앱 폭에서 아직 거칠 수 있음(2·3단계 대상).
- **2단계 프로필**, **3단계 로그인**은 같은 ①~④ 절차로 진행(가이드 6·4항 참조: StepRail/AuthCard).

## 다음 할 일

- 실제 메일 발송 후 회원가입 흐름 최종 확인(SMTP 연결됨, seed 계정은 인증 완료)
- 레거시 단일 파일(`userProfile.json` 등)은 백업으로 보존 중 — 안정화 확인 후 제거 여부 결정
- (관찰) 문서작성 배치가 headless `claude` CLI 일시 오류(exit 1)로 간헐 실패 — 스케줄 실행은 성공. 재현 잦으면 원인 조사

- 09:00 KST 경계(00:00~09:00 사이 수집분) 매칭률 배치 누락 방지 수정의 실제 경계 통과 검증은 아직 미실시 — 그 시간대 UPDATE 실행 시 확인 (07-28 10:09 KST 실행분은 경계를 지나지 않아 검증 대상 아님)
- `문서 작성 배치`(write-documents)도 같은 날짜키 수정이 적용됐으나 아직 실행 검증 전 — 다음 실행 때 대상 건수 확인

## 최근 완료

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
