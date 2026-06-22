# curryUP

사용자 프로필(경력, 기술 스택, 희망 직무 등)을 기반으로 채용 공고를 매일 자동 수집·매칭하고, 공고별로 AI가 맞춤형 자기소개서/소개/경력사항을 생성해 웹 대시보드로 보여주는 개인용 구직 도구입니다.

## 아키텍처

- **frontend/** — React + Vite. 프로필 입력, 공고 대시보드, 공고 상세(자기소개서/소개/경력사항 탭) 페이지.
- **backend/** — Express + TypeScript. 사람인 스크래퍼, 매칭 엔진, AI 문서 생성 파이프라인, node-cron 스케줄러.
  - 개발 모드에서는 Vite를 미들웨어로 품어서 backend 하나의 서버(포트 4000)로 API와 프론트엔드(HMR 포함)를 함께 서빙합니다.
  - 프로덕션 모드(`NODE_ENV=production`)에서는 `frontend/dist` 정적 빌드를 서빙합니다.
- **AI 엔진** — 로컬 [Ollama](https://ollama.com) (`qwen2.5:14b` 기본값). API 키 없이 동작합니다.
- **SKILL.md** (프로젝트 루트) — 크롤링 대상 채용 사이트 URL 목록. 직접 편집해서 관리합니다.

## 시작하기

### 1. Ollama 설치 및 모델 준비

```sh
# https://ollama.com 에서 설치 후
ollama pull qwen2.5:14b
```

### 2. 의존성 설치

```sh
cd backend && npm install
cd ../frontend && npm install
```

### 3. 개발 서버 실행 (단일 서버)

```sh
cd backend
npm run dev   # http://localhost:4000 — API + 프론트엔드(HMR) 동시 서빙
```

### (참고) 프로덕션 빌드/실행

```sh
cd backend
npm run build   # backend tsc + frontend vite build
npm start       # http://localhost:4000
```

### 4. 사용

1. `http://localhost:4000/profile` 에서 프로필을 입력하고 저장합니다. (아직 한 번도 저장하지 않았다면 백엔드 기동 시 "프로필 설정 필요" Windows 알림이 뜨고, 클릭하면 이 페이지로 이동합니다.)
2. 루트의 `SKILL.md`에 크롤링할 채용 공고 검색 URL을 추가합니다.
3. 매일 00:00~09:00 사이 매시 정각에 자동으로 공고를 수집·매칭합니다. AI 문서 생성(건당 4~5분, CPU 추론)은 부담을 줄이기 위해 분리되어 매일 23:00에 그날 쌓인 미생성 공고를 한 번에 배치로 처리합니다.
4. 매일 09:30 알림, 23:00 AI 배치 모두 백엔드가 그 시각에 꺼져 있었다면 **다음 기동 시점에 즉시 따라잡아(catch-up) 실행**합니다. (`backend/src/data/runLog.json`에 당일 처리 여부/시작·종료 시각이 기록됩니다.)
5. 23:00 배치로 새 문서가 생성되면 프론트엔드에 toast 알림("New 커리가 만들어졌다...🍛🍛🍛")이 뜨고, 클릭하면 대시보드(`/`)로 이동합니다.
6. 매일 09:30, 그날 프로필을 수정하지 않았다면 Windows 데스크톱 알림으로 업데이트를 요청합니다.
7. 대시보드(`/`)에서 매칭된 공고를 확인하고, 카드를 클릭하면 상세 페이지에서 생성된 문서를 볼 수 있습니다.

### 5. 자동 시작 (선택)

백엔드가 항상 켜져 있어야 스케줄(수집/배치/알림)이 정시에 동작합니다. Windows 로그온 시 자동 실행을 등록하려면:

```sh
cd backend
npm run build
powershell -ExecutionPolicy Bypass -File .\scripts\register-startup-task.ps1
```

제거하려면 `schtasks /delete /tn CurryUpBackend /f`. 코드를 변경했다면 `npm run build`를 다시 실행해야 반영됩니다.
