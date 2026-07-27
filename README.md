# curryUP

> 내 프로필 기반으로 채용 공고를 매일 자동 수집·매칭하고, 지원 문서까지 AI가 초안을 작성해주는 개인용 구직 자동화 도구

---

## 1. 해결하려는 문제와 접근 방식

**문제**
- 구직 중 매일 여러 채용 사이트를 수동으로 확인하는 것은 반복적이고 비효율적이다.
- 공고마다 요구 사항이 달라, 자기소개서를 처음부터 다시 쓰는 데 많은 시간이 소요된다.

**접근 방식**
1. 크롤러가 매일 22:00 사람인·잡코리아에서 공고를 자동 수집한다.
2. 경력·기술 스택·희망 직무 등 사용자 프로필과 비교해 맞는 공고만 필터링하고, 기업 평점을 조회한다.
3. 매칭된 공고(신규 고평점·즐겨찾기)에 대해 Claude Code가 자기소개서·소개·경력사항과 매칭표 초안을 자동 작성한다.
4. 웹 대시보드에서 공고와 생성된 문서를 한 곳에서 확인한다.

---

## 2. 설치 및 실행

### 2.1 사전 요구사항

- Node.js 18+
- [Claude Code](https://claude.com/claude-code) CLI — 문서 작성 배치가 headless로 호출한다.

### 2.2 설치

```sh
cd backend && npm install
cd ../frontend && npm install
```

### 2.3 실행

```sh
cd backend
npm run dev   # http://localhost:4000
```

프로덕션 빌드:

```sh
cd backend
npm run build
npm start
```

### 2.4 초기 설정

1. `http://localhost:4000/profile` 에서 경력·기술 스택·희망 직무를 입력하고 저장한다.
2. 루트의 `SKILL.md`에 크롤링할 채용 공고 검색 URL을 추가한다.

---

## 3. 서비스 전체 흐름

```
[매일 22:00] 배치 체인 (scrape → ratingCheck → write-documents)
  ① 스크래퍼
    → 사람인 / 잡코리아 공고 수집
    → 프로필 기반 매칭 필터링 (경력 ±2년, 지역, 기술 스택)
    → D-0 / D-1 마감 공고 자동 제외
    → jobPostings.json 저장
  ② 평점 조회
    → 수집 직후 이어서 기업 평점 갱신
  ③ 문서 작성 (Claude Code, 조건부)
    → 문서 미생성 공고 중 신규 고평점(평점 2.8+·매칭률 70%+) 또는 즐겨찾기 공고가 있으면
    → Claude CLI(headless)를 자동 실행해 자기소개서 / 소개 / 경력사항 / 매칭표 작성

[수동 UPDATE — 대시보드 [공고업데이트] 버튼]
  ① 수집 → ② 평점 조회 → ③ 매칭률 조회 (Claude Code) → ④ 추천 공고 팝업
    → ③ 오늘 수집분 중 매칭표(matchReport) 없는 공고에 매칭률 사전 평가표만 작성
    → ④ 오늘 수집분 중 매칭률 70% 이상 공고가 있으면 대시보드 중앙 팝업으로 제안
       (카드 클릭 → 상세를 새 탭으로 / 닫으면 같은 업데이트 세션에선 재노출 안 함)

[사용자]
  → 대시보드(/) 에서 공고 카드 확인
  → 카드 클릭 → 상세 페이지에서 생성된 문서 탭 조회 (매칭표·자기소개서·소개·경력사항)
    → 매칭표는 등급별 막대 차트로 렌더 (종합 매칭률 % 표시)
  → 불필요한 공고는 [×] 버튼으로 숨김 처리
  → /admin 에서 숨김 공고 복구 / 영구 삭제 및 배치 수동 실행
```

> 각 단계는 runLog에 기록되어 관리자 페이지에서 이력을 확인할 수 있다.
> 단, ③ 매칭률 조회·문서 작성 배치는 **대상이 0건이면 실행 이력을 남기지 않고 건너뛴다.**
> 배치 로그에 행이 없다면 실패가 아니라 대상 없음이므로, 서버 로그(`건너뜀`)를 함께 확인한다.
> notify(오전 프로필 알림) 등 스케줄 시각에 서버가 꺼져 있었다면, 다음 기동 시 즉시 catch-up 실행된다.
>
> "오늘 수집분" 판정은 `backend/src/utils/date.ts`의 **로컬(KST) 날짜 기준**을 모든 곳이 공유한다.
> `collectedAt`은 UTC ISO로 저장되므로 앞 10자를 그대로 자르면 00:00~09:00 수집분이 전날로 밀린다.
> 배치 대상 선별을 headless Claude가 수행하는 경우에도 서버가 계산한 날짜키를 프롬프트로 넘긴다.

---

## 4. 주요 컴포넌트 역할

| 위치 | 역할 |
|------|------|
| `backend/src/scrapers/` | 사람인·잡코리아 스크래퍼. `BaseScraper` 추상 클래스 기반으로 확장 가능 |
| `backend/src/matching/matchEngine.ts` | 프로필과 공고를 비교해 매칭 여부 판단. 경력(±2년) AND 지역 AND (스킬 OR 직무) |
| `backend/src/scheduler/` | node-cron 기반 스케줄러. scrape(22:00) → ratingCheck → write-documents 체인, notify(09:30) |
| `backend/src/scheduler/writeDocumentsJob.ts` | scrape·평점 조회 종료 후 대상 공고가 있으면 Claude CLI(headless)를 실행해 문서 작성 |
| `backend/src/scheduler/matchCheckJob.ts` | 수동 UPDATE 3단계. 오늘 수집분 중 매칭표 없는 공고에 Claude CLI(headless)로 매칭률 사전 평가표 작성 |
| `.claude/skills/write-documents/` | Claude Code가 공고별 매칭표·자기소개서·소개·경력사항을 작성하는 스킬. `writeDocumentsJob`이 headless로 호출 |
| `backend/src/data/store.ts` | JSON 파일 기반 데이터 레이어. 공고·숨김 공고·프로필·실행 이력 관리 |
| `backend/src/utils/date.ts` | "오늘 수집분" 판정 단일 규칙. `collectedAt`(UTC ISO)을 로컬 날짜로 환산해 비교 |
| `backend/src/routes/` | Express REST API. `/api/jobs`, `/api/profile`, `/api/admin/*` |
| `frontend/src/pages/DashboardPage.tsx` | 공고 카드 그리드. 페이지네이션(URL 기반), 숨김 처리 |
| `frontend/src/pages/AdminBatchPage.tsx` | 관리자 탭 UI. [대쉬보드 관리] / [배치 모니터링 및 제어] |
| `frontend/src/pages/JobDetailPage.tsx` | 공고 상세 + 생성 문서 탭(매칭표·자기소개서·소개·경력사항) |
| `frontend/src/components/MatchReport.tsx` | 매칭표를 등급별 막대 차트로 렌더. 표 헤더에서 등급 열(평가/매칭도)을 자동 감지 |
| `frontend/src/components/RecommendationModal.tsx` | 매칭률 70%+ 신규 공고 추천 팝업. 업데이트 세션당 1회 노출 |
| `SKILL.md` | 크롤링 대상 URL 목록. 주석(`#`) 처리로 비활성화 가능 |

---

## 5. AI 기능이 들어간 위치와 이유

**위치:** 문서 본문 작성과 매칭률 평가는 Claude Code가 담당한다.

- `.claude/skills/write-documents/SKILL.md` — 공고별 매칭표·자기소개서·소개·경력사항 작성 프롬프트 체계와 실행 절차
- `backend/src/scheduler/writeDocumentsJob.ts` — scrape·평점 조회 종료 후 대상 공고가 있으면 `claude -p`(headless)를 실행
- `backend/src/scheduler/matchCheckJob.ts` — 수동 UPDATE 흐름에서 매칭률 사전 평가표만 먼저 작성하는 `claude -p`(headless) 배치. 이후 문서 작성 배치가 이 매칭률을 재사용한다

**이유:**

| 선택 | 이유 |
|------|------|
| Claude Code 헤드리스 배치 | 별도 API 키·서버 인프라 없이 로컬 CLI로 고품질 초안 생성 |
| scrape·평점 조회 뒤 체이닝 | 수집·평점이 끝난 대상만 이어서 실행해 브라우저 상태와 무관하게 항상 수행 |
| 공고별 개별 생성 | 공고의 요구 기술·직무 키워드를 컨텍스트로 주입해 맞춤형 초안 생성 |

---

## 6. 구조적으로 고민했던 지점

**6.1 단일 서버 구조 (포트 4000)**
- 개발 편의를 위해 Express가 Vite를 미들웨어로 내장해 API와 프론트를 하나의 포트로 서빙한다.
- 프로덕션에서는 `frontend/dist` 정적 빌드를 그대로 서빙하므로 별도 웹 서버 불필요.

**6.2 배치 체이닝**
- scrape(22:00) → 평점 조회 → 문서 작성을 백엔드에서 이어서 실행해, 브라우저 탭 상태와 무관하게 밤사이 공고 수집부터 문서 초안까지 한 번에 준비되도록 설계했다.

**6.3 Soft Delete 구조**
- 대시보드에서 삭제한 공고는 `hiddenJobPostings.json`으로 이동해 복구 가능하게 유지하고, 관리자가 명시적으로 영구 삭제(Hard Delete)를 선택해야 완전히 제거된다.

**6.4 D-0/D-1 자동 제외**
- 오늘·내일 마감 공고는 실질적으로 지원이 어려우므로 수집 단계와 대시보드 로드 시 양쪽에서 자동 제외한다.

**6.5 URL 기반 페이지네이션**
- 대시보드 페이지 상태를 `?page=N` URL 쿼리로 관리해, 공고 상세에서 뒤로 가기 시 이전 페이지로 정확히 복귀한다.

---

## 7. 샘플 입출력

### 7.1 프로필 예시

```json
{
  "yearsOfExperience": 3,
  "skills": ["TypeScript", "Node.js", "React", "PostgreSQL"],
  "careerHistory": "3년간 백엔드 API 및 데이터 파이프라인 개발",
  "certifications": ["정보처리기사"],
  "locations": ["서울 강남구", "서울 서초구"],
  "desiredRoleCategories": ["백엔드 개발", "풀스택 개발"],
  "roleAnswers": {
    "주로 사용한 데이터베이스는?": "PostgreSQL, Redis",
    "대규모 트래픽/스케일링 경험이 있나요?": "일 100만 요청 규모 서비스 운영"
  },
  "learningStack": "Kubernetes, gRPC",
  "aiToolUsage": "Claude Code, Copilot 활용한 개발 자동화"
}
```

### 7.2 매칭 공고 카드 (대시보드)

```
┌─────────────────────────────┐
│  ㈜예시컴퍼니 (4.2)       ★ S │  ← 회사명 옆 괄호: 기업 평점(미조회 시 —)
│                             │   ← 좌: 출처 / 우: 즐겨찾기(★ 등록·☆ 미등록) 사람인 S / 잡코리아 J
│  서울 강남구                  │
│  백엔드 개발자 (Node.js)      │
│                              │
│  D-7                      × │  ← 좌: 마감 D-day / 우: 숨김
└─────────────────────────────┘
```

- **★ / ☆** — 즐겨찾기 토글. 즐겨찾기 공고는 평점·매칭률 조건 없이 문서 작성 배치 대상이 된다.
- **(4.2)** — `ratingCheck` 배치가 조회한 기업 평점. 신규 공고는 평점 2.8 이상일 때만 문서 작성 대상이 된다.
