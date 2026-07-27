import { Router } from "express";
import { getJobPostings, hideJob, toggleFavorite } from "../data/store.js";
import { getLatestRun } from "../scheduler/runLog.js";
import type { JobPosting } from "../types.js";
import { isCollectedToday, todayLocalKey } from "../utils/date.js";
import { daysUntilDeadline } from "../utils/deadline.js";

export const jobsRouter = Router();
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
  const allJobs = await getJobPostings();

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
jobsRouter.get("/all", async (_req, res) => {
  const allJobs = await getJobPostings();
  const sorted = [...allJobs].sort(compareJobs);
  res.json({ items: sorted });
});

// 추천 공고 팝업(수동 업데이트 파이프라인 4단계)용. 오늘 수집된 공고 중 매칭률 종합 70% 이상만 반환한다.
// sessionId: 이번 업데이트 세션 식별자(= 오늘 완료된 가장 최근 수동 collect 실행 id). 팝업 중복 노출
// 방지를 위해 프런트가 이 값을 dismiss 플래그로 사용한다. 오늘 수동 수집이 없으면 null(팝업 미노출).
// 주의: 이 라우트는 "/:id"보다 먼저 등록해야 "recommendations"가 id로 매칭되지 않는다.
jobsRouter.get("/recommendations", async (_req, res) => {
  const jobs = await getJobPostings();
  const items = jobs
    .filter((j) => isCollectedToday(j.collectedAt))
    .filter((j) => {
      const overall = matchOverall(j.documents?.matchReport);
      return overall !== null && overall >= 70;
    })
    .sort(compareJobs);

  const latestCollect = await getLatestRun("collect", "manual");
  // runLog의 date도 같은 로컬 날짜 기준이라 그대로 비교한다.
  const sessionId = latestCollect && latestCollect.date === todayLocalKey() ? latestCollect.id : null;

  res.json({ sessionId, items });
});

jobsRouter.get("/:id", async (req, res) => {
  const jobs = await getJobPostings();
  const job = jobs.find((j) => j.id === req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

jobsRouter.patch("/:id/favorite", async (req, res) => {
  const result = await toggleFavorite(req.params.id);
  if (result === null) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({ isFavorite: result });
});

jobsRouter.delete("/:id", async (req, res) => {
  const success = await hideJob(req.params.id);
  if (!success) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({ success: true });
});
