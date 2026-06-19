# curryUP

사용자 프로필(경력, 기술 스택, 희망 직무 등)을 기반으로 채용 공고를 매일 자동 수집·매칭하고, 공고별로 AI가 맞춤형 자기소개서/소개/경력사항을 생성해 웹 대시보드로 보여주는 개인용 구직 도구입니다.

## 아키텍처

- **frontend/** — React + Vite. 프로필 입력, 공고 대시보드, 공고 상세(자기소개서/소개/경력사항 탭) 페이지.
- **backend/** — Express + TypeScript. 사람인 스크래퍼, 매칭 엔진, AI 문서 생성 파이프라인, node-cron 스케줄러.
- **AI 엔진** — 로컬 [Ollama](https://ollama.com) (`qwen2.5:14b` 기본값). API 키 없이 동작합니다.
- **SKILL.md** (프로젝트 루트) — 크롤링 대상 채용 사이트 URL 목록. 직접 편집해서 관리합니다.

## 시작하기

### 1. Ollama 설치 및 모델 준비

```sh
# https://ollama.com 에서 설치 후
ollama pull qwen2.5:14b
```

### 2. 백엔드 실행

```sh
cd backend
npm install
npm run dev   # http://localhost:4000
```

### 3. 프론트엔드 실행

```sh
cd frontend
npm install
npm run dev   # http://localhost:5173 (포트가 사용 중이면 다음 포트로 자동 변경)
```

### 4. 사용

1. `http://localhost:5173/profile` 에서 프로필을 입력하고 저장합니다.
2. 루트의 `SKILL.md`에 크롤링할 채용 공고 검색 URL을 추가합니다.
3. 매일 00:00~09:00 사이 매시 정각에 자동으로 공고를 수집·매칭하고 AI 문서를 생성합니다. 백엔드 서버가 그 시간에 켜져 있어야 합니다.
4. 매일 09:30, 그날 프로필을 수정하지 않았다면 Windows 데스크톱 알림으로 업데이트를 요청합니다.
5. 대시보드(`/`)에서 매칭된 공고를 확인하고, 카드를 클릭하면 상세 페이지에서 생성된 문서를 볼 수 있습니다.
