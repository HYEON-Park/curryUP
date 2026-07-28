import { Router } from "express";
import { getHiddenJobs, getJobPostings, hasProfile, permanentDeleteAllHiddenJobs, permanentDeleteHiddenJobs, restoreJob } from "../data/store.js";
import { MATCH_CHECK_JOB_NAME, runMatchCheckIfNeeded } from "../scheduler/matchCheckJob.js";
import { runNotifyNow } from "../scheduler/notifyJob.js";
import { RATING_CHECK_JOB_NAME, runRatingCheckNow } from "../scheduler/ratingCheckJob.js";
import { getRunHistory, isJobRunning } from "../scheduler/runLog.js";
import { runScrapeNow } from "../scheduler/scrapeJob.js";
import { runWriteDocumentsIfNeeded, WRITE_DOCS_JOB_NAME } from "../scheduler/writeDocumentsJob.js";

export const adminRouter = Router();

adminRouter.get("/runs", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  res.json(await getRunHistory(page));
});

adminRouter.post("/scrape/run", async (req, res) => {
  // 프로필이 없으면 초기화(삭제)까지 막아야 하므로 재수집 진입 전에 차단한다(프런트도 동일 가드).
  if (!(await hasProfile())) {
    res.status(400).json({ error: "NO_PROFILE" });
    return;
  }
  const scope = req.query.scope === "all" ? "all" : "today";
  res.json(await runScrapeNow(scope));
});

adminRouter.post("/notify/run", async (_req, res) => {
  res.json(await runNotifyNow());
});

adminRouter.get("/ai/status", async (_req, res) => {
  const running = await isJobRunning(WRITE_DOCS_JOB_NAME);
  res.json({ running });
});

// Claude Code 문서 작성 배치는 수 분 걸릴 수 있어 응답을 기다리지 않고 즉시 시작만 알린다.
// 작성 대상이 없으면 runWriteDocumentsIfNeeded가 실행 이력 없이 건너뛴다. 진행 상황은 GET /runs 폴링으로 확인한다.
adminRouter.post("/ai/run", (_req, res) => {
  runWriteDocumentsIfNeeded().catch((error) => console.error("[admin] write-documents batch failed:", error));
  res.status(202).json({ started: true });
});

adminRouter.get("/rating-check/status", async (_req, res) => {
  const running = await isJobRunning(RATING_CHECK_JOB_NAME);
  res.json({ running });
});

// 회사 수만큼 순차 크롤링이라 몇 분 걸릴 수 있어 응답을 기다리지 않고 즉시 시작만 알린다.
adminRouter.post("/rating-check/run", (_req, res) => {
  runRatingCheckNow().catch((error) => console.error("[admin] rating check batch failed:", error));
  res.status(202).json({ started: true });
});

adminRouter.get("/match-check/status", async (_req, res) => {
  const running = await isJobRunning(MATCH_CHECK_JOB_NAME);
  res.json({ running });
});

// 당일 수집분의 매칭률 평가표를 Claude가 작성하는 배치. 수 분 걸릴 수 있어 시작만 알린다.
// 대상이 없으면 실행 이력 없이 건너뛴다(started:false). 진행 상황은 GET /runs 폴링으로 확인한다.
adminRouter.post("/match-check/run", (_req, res) => {
  runMatchCheckIfNeeded().catch((error) => console.error("[admin] match check batch failed:", error));
  res.status(202).json({ started: true });
});

adminRouter.get("/favorites", async (_req, res) => {
  const all = await getJobPostings();
  res.json(all.filter((j) => j.isFavorite === true));
});

const HIDDEN_PAGE_SIZE = 20;

adminRouter.get("/hidden-jobs", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const all = await getHiddenJobs();
  const start = (page - 1) * HIDDEN_PAGE_SIZE;
  res.json({
    items: all.slice(start, start + HIDDEN_PAGE_SIZE),
    page,
    totalPages: Math.max(1, Math.ceil(all.length / HIDDEN_PAGE_SIZE)),
    totalItems: all.length,
  });
});

adminRouter.post("/hidden-jobs/purge-selected", async (req, res) => {
  const { ids } = req.body as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids array required" });
    return;
  }
  await permanentDeleteHiddenJobs(ids);
  res.json({ success: true });
});

adminRouter.post("/hidden-jobs/purge-all", async (_req, res) => {
  await permanentDeleteAllHiddenJobs();
  res.json({ success: true });
});

adminRouter.post("/hidden-jobs/:id/restore", async (req, res) => {
  const success = await restoreJob(req.params.id);
  if (!success) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({ success: true });
});
