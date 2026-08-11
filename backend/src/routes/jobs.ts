import { Router } from "express";
import { authMiddleware } from "../auth/jwt.js";
import { getJobPostings, hideJob, toggleFavorite } from "../data/store.js";
import { getLatestRun } from "../scheduler/runLog.js";
import {
  getSingleDocState,
  isDocType,
  startSingleDocGeneration,
} from "../scheduler/singleDocJob.js";
import type { JobPosting } from "../types.js";
import { localDateKey } from "../utils/date.js";
import { daysUntilDeadline } from "../utils/deadline.js";

export const jobsRouter = Router();
jobsRouter.use(authMiddleware);
const PAGE_SIZE = 12;

// 매칭표에서 "종합 매칭률: N%" 값을 추출한다. (프런트 utils/matchReport.ts와 동일 규칙)
function matchOverall(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/종합\s*매칭률\s*[:：]?\s*(\d+)\s*%/);
  return m ? Number(m[1]) : null;
}

// 대시보드 카드 강조 조건과 동일(프런트 isHighlighted): 즐겨찾기이거나 매칭률 종합 70% 이상.
// 매칭률은 documents.matchReport 한 곳에만 쌓인다(매칭률 조회 배치·문서 작성 배치 공통).
// 상단 고정 우선순위: 즐겨찾기(0) > 매칭률 70%+(1) > 일반(2). 낮을수록 위로.
function priorityRank(job: JobPosting): number {
  if (job.isFavorite === true) return 0;
  const overall = matchOverall(job.documents?.matchReport);
  if (overall !== null && overall >= 70) return 1;
  return 2;
}

// 먼저 우선순위 티어(즐겨찾기 → 매칭률 70%+ → 일반)로 올리고, 같은 티어 안에서는 기존 기준을 적용한다:
// D-day가 긴(남은 일수가 많은) 순, 같으면 기업명 가나다순, 마감일이 없는 공고는 맨 뒤(그 안에서 가나다순).
function compareJobs(a: JobPosting, b: JobPosting): number {
  const rankDiff = priorityRank(a) - priorityRank(b);
  if (rankDiff !== 0) return rankDiff;

  const aDays = daysUntilDeadline(a.deadline);
  const bDays = daysUntilDeadline(b.deadline);

  if (aDays === null && bDays === null) return a.company.localeCompare(b.company, "ko");
  if (aDays === null) return 1;
  if (bDays === null) return -1;
  if (aDays !== bDays) return bDays - aDays;
  return a.company.localeCompare(b.company, "ko");
}

// 마감 임박(D-0~N) 공고 정리는 deleteImminentJobPostings()(서버 기동 시 + 매일 08:00 scrapeTask)가
// 전담하므로, 여기서는 순수하게 저장된 목록을 읽어 응답하기만 한다.
jobsRouter.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const allJobs = await getJobPostings(req.user!.userId);

  const sorted = [...allJobs].sort(compareJobs);
  const start = (page - 1) * PAGE_SIZE;
  res.json({
    items: sorted.slice(start, start + PAGE_SIZE),
    page,
    totalPages: Math.max(1, Math.ceil(sorted.length / PAGE_SIZE)),
    totalItems: sorted.length,
  });
});

// 대시보드 다중 조건 검색(회사명/제목/지역)은 전체 페이지를 대상으로 해야 하므로,
// 클라이언트가 검색을 활성화할 때 페이지네이션 없이 전체 목록을 한 번에 내려준다.
jobsRouter.get("/all", async (req, res) => {
  const allJobs = await getJobPostings(req.user!.userId);
  const sorted = [...allJobs].sort(compareJobs);
  res.json({ items: sorted });
});

// 추천 공고 팝업(수동 업데이트 파이프라인 4단계)용. 가장 최근 수집 세션이 모은 공고 중
// 매칭률 종합 70% 이상만 반환한다.
// sessionId: 이번 수집 세션 식별자(= 수집 파이프라인의 가장 최근 실행 id). 프런트가 이 값을
// dismiss 플래그(localStorage)로 써서 "이미 본 세션"은 다시 띄우지 않는다. 수집 이력이 없으면 null.
// 주의: 이 라우트는 "/:id"보다 먼저 등록해야 "recommendations"가 id로 매칭되지 않는다.
//
// 날짜 경계와 무관하게 "최신 세션" 기준으로 판정한다.
// (예전엔 date===today로 제한해, 20시 스케줄 scrape로 수집하고 다음 날 아침 대시보드를 열면
//  날짜가 넘어가 sessionId=null·items=0 → 팝업이 아예 안 떴다. 이제 그 세션을 한 번 볼 때까지 뜬다.)
jobsRouter.get("/recommendations", async (req, res) => {
  const userId = req.user!.userId;

  // 세션 식별: 수집 파이프라인(수동 collect·스케줄 scrape)의 가장 최근 실행.
  // 수동 UPDATE(collect)든 스케줄 배치(scrape)든 같은 산출(매칭표)을 내므로 둘 다 인정한다.
  const pipelineRuns = (await Promise.all([getLatestRun(userId, "collect"), getLatestRun(userId, "scrape")])).filter(
    (r): r is NonNullable<typeof r> => r !== null,
  );
  const sessionRun = pipelineRuns.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null;
  const sessionId = sessionRun ? sessionRun.id : null;

  // 추천 항목: 그 세션이 수집한 날짜의 공고 중 미종료·종합 매칭률 70% 이상.
  // runLog의 date도 같은 로컬 날짜 기준이라 collectedAt의 로컬 날짜키와 그대로 비교한다.
  const jobs = await getJobPostings(userId);
  const items = sessionRun
    ? jobs
        .filter((j) => localDateKey(j.collectedAt) === sessionRun.date)
        .filter((j) => !j.disabled) // 종료 공고는 추천에서 제외.
        .filter((j) => {
          const overall = matchOverall(j.documents?.matchReport);
          return overall !== null && overall >= 70;
        })
        .sort(compareJobs)
    : [];

  res.json({ sessionId, items });
});

jobsRouter.get("/:id", async (req, res) => {
  const jobs = await getJobPostings(req.user!.userId);
  const job = jobs.find((j) => j.id === req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

jobsRouter.patch("/:id/favorite", async (req, res) => {
  const result = await toggleFavorite(req.user!.userId, req.params.id);
  if (result === null) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({ isFavorite: result });
});

jobsRouter.delete("/:id", async (req, res) => {
  const success = await hideJob(req.user!.userId, req.params.id);
  if (!success) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({ success: true });
});

// 공고 상세 페이지: 해당 탭 문서를 사용자가 직접 즉시 생성한다(Claude CLI headless).
// 저장 위치는 기존 documents.{docType}를 그대로 재사용한다.
jobsRouter.post("/:id/documents/:docType/generate", async (req, res) => {
  const { id, docType } = req.params;
  if (!isDocType(docType)) {
    res.status(400).json({ error: "INVALID_DOC_TYPE" });
    return;
  }
  const result = await startSingleDocGeneration(req.user!.userId, id, docType);
  switch (result) {
    case "no-profile":
      res.status(400).json({ error: "NO_PROFILE" });
      return;
    case "not-found":
      res.status(404).json({ error: "Job not found" });
      return;
    case "busy":
      res.status(409).json({ error: "BUSY" });
      return;
    default:
      res.status(202).json({ started: true });
  }
});

// 생성 상태 폴링용. running=false + hasContent=true면 완료, running=false + hasContent=false면 실패.
jobsRouter.get("/:id/documents/:docType/status", async (req, res) => {
  const { id, docType } = req.params;
  if (!isDocType(docType)) {
    res.status(400).json({ error: "INVALID_DOC_TYPE" });
    return;
  }
  const jobs = await getJobPostings(req.user!.userId);
  const job = jobs.find((j) => j.id === id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(getSingleDocState(req.user!.userId, id, docType, job.documents?.[docType]));
});
