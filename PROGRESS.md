# PROGRESS

> 마지막 갱신: 2026-10-25

현재 무엇을 하는 중이고 다음에 뭘 할지 추적하는 문서. 세션 시작 시 이 파일을 먼저 읽는다.
(변경 이력 자체는 `CHANGELOG.md`, 구조 설명은 `README.md`가 담당한다.)

## 현재 작업 중

### 2026-10-25 — 문서 개인정보 삭제 및 온보딩 문서 커밋 제외

- AI_ONBOARDING.md·PROGRESS.md의 식별 정보와 개인 입력 내용, 문서 작성 스킬의 개인 경력 예문, 변경 이력의 개인 매칭 결과를 삭제했습니다. 일반 운영·작성 규칙은 유지합니다. 추가 요청에 따라 문서 작성 예시는 실제 개인정보 없는 자리표시자 형식으로 보존합니다.
- CLAUDE.md에 AI_ONBOARDING.md의 영구 commit·push 제외 규칙을 기록했습니다. 문서 내용 재검색·변경 형식 검사로 확인하며 Git 과거 이력은 변경하지 않습니다.
- 2026-10-26 01:00(KST) 푸시 예약은 사용자 요청으로 취소했습니다. 작업 스케줄러 미등록 확인 및 준비 스크립트 제거 완료. 자동 커밋·푸시는 실행하지 않습니다.

- 원격 추가 점검: 예전 월별 변경 이력·README의 식별 정보와 내부 주소도 로컬에서 정리했습니다. userProfile.example.json은 실제 값을 모두 제거한 자리표시자 템플릿으로 교체하고 원본은 userProfile.example.private.json으로 로컬 보존·Git 제외했습니다. 실제 값이 포함된 예시의 영구 커밋 금지 규칙을 CLAUDE.md에 명시했습니다.
- AI_ONBOARDING.md 추적 제거 및 .gitignore 등록 커밋 b3f5940 생성(로컬 파일 유지). 나머지 개인정보 제거와 재커밋 방지 규칙을 묶어 원격 최신 파일에 반영합니다. 과거 Git 이력은 유지합니다. 전체 회귀 테스트 33개 및 양쪽 타입 검사 통과.

### 2026-10-25 — 매칭률·평점 기준 삭제 목록 자동 이동 완료

- 매칭률 59% 이하 또는 매칭률 60% 이상·회사 평점 2.6 이하인 공고를 기존 삭제 목록으로 이동합니다. 매칭 평가 완료·회사별 평점 저장 직후 적용하며, 미평가·평점 조회 불가 공고는 유지합니다. 즐겨찾기도 동일 적용하고 문서를 보존합니다.
- 기존 수동 삭제와 쓰기 잠금을 공유하도록 정리했습니다. 운영 기준은 루트 SKILL.md, 판정은 utils/jobQuality.ts에 기록했습니다.
- 회귀 테스트 18개·백엔드 타입 검사 통과. 실행 중 배치 없음 확인 후 기존 저장 공고에도 적용해 159건 이동 완료. 일회성 적용 스크립트 제거, 서버 재시작·commit·push 미실시.

### 2026-10-25 — 종료 점검 후 자동 삭제 완료

- 수동·예약 점검 성공 시 신규 종료 확인 공고와 기존 disabled 공고를 자동 삭제합니다. 기존 쓰기 잠금으로 최신 수정·추가 공고를 보존하고, 점검 실패 시 삭제하지 않습니다. 종료 확인 목록은 실행 이력에 유지합니다.
- 회귀 테스트 2개·백엔드 타입 검사 통과. 실제 사용자 데이터 삭제·서버 재시작은 미실시했습니다.

### 2026-10-14 — 공고번호 기준 중복 수집 방지 완료

- 기존 URL·ID 검사에 출처별 공고번호 검사 추가: 사람인 rec_idx, 잡코리아 GI_Read 번호. 기존·숨김·이번 수집에서 채택된 공고에 적용하며 기존 ID와 문서는 보존합니다.
- 중복 판별 테스트 3개 및 백엔드 타입 검사 통과. 실제 외부 수집 실행·서버 재시작은 미실시했습니다.


### 2026-10-13 — 수동 수집 사람인 타임아웃 진단

- 실행 이력 확인: 12:10:55(KST) 수동 collect는 사람인 DNS 조회 실패(ENOTFOUND), 12:11:49 실행은 약 20초 뒤 Axios 타임아웃으로 실패했습니다. DNS·네트워크·원격 응답 문제의 구체 원인은 미확정입니다.
- 진단 당시 코드 확인: SaraminScraper 목록 요청은 20초 제한이며 재시도가 없었습니다. 오류가 전파되면 runScrapeAndMatch의 최종 저장에 도달하지 않고, collect 라우트는 500을 반환해 후속 매칭률·평점·메일·문서 작업을 시작하지 않습니다.
- 현재 외부 연결 검증: 샌드박스 밖에서 동일 User-Agent·20초 제한의 Axios GET으로 첫 사람인 검색 URL(recruitPage=1)을 요청해 HTTP 200·819ms·공고 목록 HTML 포함을 확인했습니다. 현재는 재현되지 않으며 당시 DNS 실패와 타임아웃의 구체 원인(로컬 연결/DNS/원격 지연)은 로그만으로 구분되지 않습니다.
- 후속 요청으로 사람인 목록 요청에 연결 오류 재시도를 추가했습니다. 기본 최초 요청 + 2회 재시도, SARAMIN_RETRY_COUNT 환경변수로 0~10회 지정(잘못된 값은 기본값), 대기 1초·2초 순 증가, 요청별 20초 제한 유지. HTTP 오류는 재시도하지 않으며 소진 시 원래 오류를 전달합니다.
- 검증: 재시도 성공·소진·0/1회 설정·HTTP 403 제외·잘못된 설정 기본값 테스트 6개와 백엔드 타입 검사 통과.
- 후속 진행 완료: 전체 runLog에 running 없음 확인 후 기존 백엔드를 정리하고 숨김 독립 서버 재기동, localhost:4000 HTTP 200 확인. 실패 실행의 동일 사용자로 실제 수집 실행(12:37:49~12:39:24 KST) success, 수집 612건·신규 매칭 17건 저장. 실측 중 재시도 로그는 없었으며 재시도 자체는 모의 오류 테스트로 검증했습니다. 수집 단계만 검증해 후속 매칭률·평점·메일·문서 작업은 호출하지 않았습니다. 일회성 검증 스크립트 제거, commit·push 미실시.
- 추가 요청으로 후속 배치 실행 완료: 실제 저장된 세션 공고 11건 매칭표 생성 후 검증기가 '임의 가중치·산식은 적용하지 않았다'라는 부정 설명까지 거부해 failed. 점수·근거를 보존하고 해당 설명만 정리해 13:29:50 KST 전체 재검증 success 기록. 원본 백업: 사용자 Temp/curryup-report-repair-TchMyt/before.json. 검증기 소스는 변경하지 않았습니다.
- 로그 최종 확인: 평점조회 13:30:24 KST success(4건 갱신·1건 조회 불가), write-documents 13:35:43 KST success(6건 작성). 모든 사용자 running 없음 확인 후 요청한 Windows OS 완료 알림 전송 성공. 메일은 발송하지 않았으며 일회성 실행·복구·알림 스크립트는 제거했습니다. 검증기의 부정 문구 오탐은 후속 개선 대상입니다.

- CHANGELOG/2026-10.md에 재시도 수정·검증과 후속 배치 복구·완료 알림을 기록했습니다. CLAUDE.md에 실제 변경사항이 있으면 최종 답변 전에 changelog를 별도 요청 없이 자동 기록하는 규칙을 추가했습니다.

### 2026-10-06 — 매칭률 그래프 결함 수정·화면 검증 완료

- **적용**: progress-handoff.patch는 이미 적용된 상태를 역방향 검사로 확인. match-report-fix.patch를 적용하고 기존 사용자 변경사항을 보존했습니다.
- **코드**: 등급 환산·평가표 파서를 backend 유틸로 공유. 매칭 열·복합 등급·빈 셀을 처리하고 미확인 등급은 정보 없음으로 표시합니다. 신규 생성은 기존 4개 평가 항목·단일 등급·근거·강점·갭·권장도를 검증하고 임의 가중치를 거부합니다. 기존 문서는 보존하고 생성 대상 필드만 검증합니다.
- **검증**: 백엔드 tsc --noEmit·프런트 tsc --noEmit -p tsconfig.app.json 통과. 자동화·파서 테스트 13건 통과. 샌드박스 tsx ENOMEM은 승인된 외부 실행으로 해결했습니다. 모든 사용자 runLog에 running 없음·기존 서버 없음 확인 후 숨김 서버를 기동했습니다.
- **변경 파일**: .claude/skills/write-documents/SKILL.md, backend/src/utils/matchReport.ts, backend/src/services/documentValidation.ts, backend/src/services/codexRunner.ts, backend/src/scheduler/writeDocumentsJob.ts, backend/src/server.ts, frontend/src/components/MatchReport.tsx, backend/scripts/test-codex-automation.mts, backend/scripts/test-match-report.mts(신설), CHANGELOG/2026-10.md. commit·push 미실시.

### 2026-09-02 — 문서작성 대상을 "오늘의 추천공고"로 단일화 (평점 null 누락 결함 수정)

- **결함**: 문서작성 배치가 오늘의 추천공고 중 평점 `null`인 공고를 통째로 건너뜀. 추천공고는 평점 null을 포함하는데 문서작성 대상 판정은 `rating>=2.8`(null→제외)이라 규칙이 이원화돼 있었음.
- **조치**: `writeDocumentsJob`의 `countTargets`(평점 재계산) 제거 → `collectDocTargets`가 `getRecommendations`(오늘의 추천공고) ∪ 즐겨찾기를 그대로 대상으로 삼고, 매칭률 배치처럼 서버가 대상 id를 확정해 프롬프트에 주입. Claude는 재필터 없이 지정 id만 작성. SKILL 기준 설명도 추천공고 기준으로 정정.
- 수정: `backend/src/scheduler/writeDocumentsJob.ts`, `.claude/skills/write-documents/SKILL.md`. `tsc --noEmit` 통과. **미실시**: 배치 재실행 라이브 검증(누락 2건 실제 생성). 커밋 안 함.

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

### 2026-10-02 — Codex 자동화 전환 및 매칭률 70% 이상 공고 평점 재조회

- Claude CLI 호출 4곳을 공통 Codex 실행기로 전환. 기존 사용자별 JSON·documents·작성 스킬과 대상 기준 재사용. UTF-8 stdin, backend 쓰기 샌드박스, 순차 실행, 오류 출력·최종 메시지 분리, 30분 제한. PDF.js 텍스트 추출 후 읽기 전용 Codex로 프로필 JSON 반환(스캔 PDF 미지원).
- 매칭률/평점 배치 실패 시 후속 작업 중단. CLI 성공 후 저장 문서 누락·점수 범위·핵심역량 길이 검증. 예약 재시도는 최초 수집 세션 경계를 유지.
- 검증: tsc --noEmit, 실패 처리 테스트 7개, 실제 Codex 단일 문서 생성/한글 저장/기존 문서 보존/runLog 성공, 샘플 PDF→프로필 JSON 반환 통과. 4000 dev 서버는 tsx watch로 변경 반영, HTTP 200 확인. 미실시: 화면 버튼 실제 클릭·야간 스케줄 시각 실측.
- 상세: backend/CODEX_AUTOMATION.md. 기존 CHANGELOG/2026-09.md의 사용자 수정은 유지.



### 2026-08-14 — 배치 대상 유저 등록(관리자) + 매칭배치 세션범위 + UPDATE 완료메일 추천공고

- **배치 대상 등록**: 자동 배치 대상을 `getBatchUserId`(로컬 로그인 유저 1명) → **관리자가 등록한 유저 전부**로 전환. `User.batchEnabled`(users.json 재사용, 새 파일·새 배치 없음)로 판정. 스케줄러 4개(scrape·writeDocuments·notify·closedCheck)+server.ts 기동정리를 **사용자별 순차 루프**(`for..await`)로 교체 — Claude CLI가 항상 1개만 구동(결정: 사용자별 순차 / 등록목록 완전대체 / 등록만·실행은 cron).
  - 신규 store 함수 `getBatchUserIds`·`listBatchCandidates`·`setBatchEnabled`, admin 라우트 `GET/PATCH /admin/batch-users`, 프론트 `AdminBatchPage` "배치 대상 등록" 탭 + client `fetchBatchUsers`·`setBatchUserEnabled`.
  - ⚠️ 마이그레이션: `batchEnabled` 없는 기존 유저는 대상에서 빠짐 → hyeon 본인도 관리자 화면에서 한 번 등록해야 스케줄 배치가 다시 돎.
- **매칭률 조회 배치 세션범위화**: `isCollectedToday`(오늘 일자 전체) → **최근 수집 세션(collect/scrape run) startedAt 이후 + matchReport 없는 공고**만 대상. 서버가 대상 id 목록을 프롬프트에 명시 → Claude가 파일 전체 스캔 안 함(토큰 절약). 같은 날 08시 세션·오후 세션 분리. `matchCheckJob.ts`. 메모리 [[feedback_matchcheck_session_scope]].
- **UPDATE 완료 메일에 오늘의 추천공고**: 추천 판정을 `utils/recommendations.getRecommendations`로 단일화(라우트에서 중복 이사 — `matchOverall`·`compareJobs`·`priorityRank` 공유). `mailer.sendUpdateCompleteEmail(to, summary, recommendations)`에 70%+ 목록 섹션 추가(없으면 생략). `collect.ts`·`scrapeJob.ts`가 전달. 테스트 메일 발송 검증 완료.
- 백·프론트 `tsc --noEmit` 통과. **미검증**: 4000 라이브 화면(배치 대상 등록 탭 토글·실제 스케줄 다유저 순차 실행). 커밋 안 함.

### 2026-08-13 — 프로필 수정: PDF 이력서 자동 읽기 (CLI headless)

- `/profile/edit`에 `[PDF로 프로필 읽기]` 버튼(모달) 추가. PDF 업로드 → 경력·학력·스킬·자격증·희망직무·소개글을 자동 추출해 폼에 주입(기존 값 초기화 후 덮어쓰기).
- **AI 엔진 결정**: PRD의 Anthropic API(Haiku) 대신 **기존 `claude` CLI headless 재사용**(과금 0, `singleDocJob`과 동일 spawn 패턴). 정규식 선행/PDF 라이브러리/multer **미도입**(사용자 확정). CLI가 리포의 `types.ts`·`profileFormMeta.ts`·`jobCategoryMeta.ts`를 직접 읽어 유효 enum/라벨로 매핑 → 백엔드에 택소노미 중복 정의 없음.
- **핵심 결정/함정**: 임시 PDF는 **반드시 리포(=CLI cwd) 내부**에 저장(`.resume-tmp-*`, .gitignore). headless `claude -p`는 프로젝트 밖 파일 Read에 권한 승인이 필요해 무인 모드에선 막혀 빈 출력이 난다(초기 실패 원인). 파싱 직후 임시파일 삭제(개인정보).
- 전송은 `application/pdf` 원본 바이너리(전역 express.json 우회) → 라우트 `express.raw`. CLI는 stdout JSON만 반환(프로필 파일 미수정), 반환 날짜는 YYYYMM 6자리로 정규화·스키마 밖 필드는 무시.
- 신규: `backend/src/services/resumeParser.ts`. 수정: `backend/src/routes/profile.ts`, `frontend/src/api/client.ts`, `frontend/src/pages/ProfileEditPage.tsx`, `frontend/src/App.css`, `.gitignore`.
- 백·프론트 `tsc --noEmit` 통과. **실검증 완료**: 제공된 예시 PDF(3페이지)로 e2e 실행 → 53초, 경력 3건·학력·스킬·희망직무 전부 유효값으로 정확 매핑 확인. 4000 화면에서 버튼→업로드→폼주입 라이브 클릭 검증은 미실시.

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

### 2026-07-28 — 멀티테넌트 이메일 인증 + seed 계정 데이터 마이그레이션 (실행 완료)

- 이메일 인증(링크) 실제 SMTP 발송 연결(Gmail 앱 비밀번호, `backend/.env`). 인증 링크 base URL = 실행 환경의 서버 주소라 같은 네트워크 폰에서도 인증 가능. SMTP verify 성공.
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

### 2026-07-28 — 수동 공고 편입 검증

- 기존 스크래퍼와 저장 구조를 재사용해 수동 편입을 검증했습니다. 동명 회사의 다른 직무 공고가 잘못 선택되지 않도록 확인했습니다.

### 2026-07-28 — 미평가 공고 처리 검증

- 기존 documents.matchReport에 평가 결과를 병합하고 파싱을 검증했습니다. 개인별 회사·점수·순위는 공개 작업 이력에 기록하지 않습니다.

### 2026-07-28 — 수동 UPDATE 실행 검증

- 수집·평점 조회와 대상이 없는 매칭률 배치의 건너뛰기 동작을 확인했습니다. 프로필과 맞지 않는 공고의 필터 동작도 확인했습니다.

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
