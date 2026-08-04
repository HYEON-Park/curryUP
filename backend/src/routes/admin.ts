import { Router } from "express";
import { authMiddleware } from "../auth/jwt.js";
import { getHiddenJobs, getJobPostings, hasProfile, permanentDeleteAllHiddenJobs, permanentDeleteHiddenJobs, restoreJob } from "../data/store.js";
import { runClosedCheckNow } from "../scheduler/closedCheckJob.js";
import { MATCH_CHECK_JOB_NAME, runMatchCheckIfNeeded } from "../scheduler/matchCheckJob.js";
import { runNotifyNow } from "../scheduler/notifyJob.js";
import { RATING_CHECK_JOB_NAME, runRatingCheckNow } from "../scheduler/ratingCheckJob.js";
import { getRunHistory, isJobRunning } from "../scheduler/runLog.js";
import { runScrapeNow } from "../scheduler/scrapeJob.js";
import { runWriteDocumentsIfNeeded, WRITE_DOCS_JOB_NAME } from "../scheduler/writeDocumentsJob.js";

export const adminRouter = Router();
adminRouter.use(authMiddleware);

adminRouter.get("/runs", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  res.json(await getRunHistory(req.user!.userId, page));
});

adminRouter.post("/scrape/run", async (req, res) => {
  const userId = req.user!.userId;
  // 프로필이 없으면 초기화(삭제)까지 막아야 하므로 재수집 진입 전에 차단한다(프런트도 동일 가드).
  if (!(await hasProfile(userId))) {
    res.status(400).json({ error: "NO_PROFILE" });
    return;
  }
  const scope = req.query.scope === "all" ? "all" : "today";
  res.json(await runScrapeNow(userId, scope));
});

adminRouter.post("/notify/run", async (req, res) => {
  res.json(await runNotifyNow(req.user!.userId));
});

adminRouter.get("/ai/status", async (req, res) => {
  const running = await isJobRunning(req.user!.userId, WRITE_DOCS_JOB_NAME);
  res.json({ running });
});

// Claude Code 문서 작성 배치는 수 분 걸릴 수 있어 응답을 기다리지 않고 즉시 시작만 알린다.
// 작성 대상이 없으면 runWriteDocumentsIfNeeded가 실행 이력 없이 건너뛴다. 진행 상황은 GET /runs 폴링으로 확인한다.
adminRouter.post("/ai/run", (req, res) => {
  const userId = req.user!.userId;
  runWriteDocumentsIfNeeded(userId).catch((error) => console.error("[admin] write-documents batch failed:", error));
  res.status(202).json({ started: true });
});

adminRouter.get("/rating-check/status", async (req, res) => {
  const running = await isJobRunning(req.user!.userId, RATING_CHECK_JOB_NAME);
  res.json({ running });
});

// 회사 수만큼 순차 크롤링이라 몇 분 걸릴 수 있어 응답을 기다리지 않고 즉시 시작만 알린다.
adminRouter.post("/rating-check/run", (req, res) => {
  const userId = req.user!.userId;
  runRatingCheckNow(userId).catch((error) => console.error("[admin] rating check batch failed:", error));
  res.status(202).json({ started: true });
});

adminRouter.get("/match-check/status", async (req, res) => {
  const running = await isJobRunning(req.user!.userId, MATCH_CHECK_JOB_NAME);
  res.json({ running });
});

// 당일 수집분의 매칭률 평가표를 Claude가 작성하는 배치. 수 분 걸릴 수 있어 시작만 알린다.
// 대상이 없으면 실행 이력 없이 건너뛴다(started:false). 진행 상황은 GET /runs 폴링으로 확인한다.
adminRouter.post("/match-check/run", (req, res) => {
  const userId = req.user!.userId;
  runMatchCheckIfNeeded(userId).catch((error) => console.error("[admin] match check batch failed:", error));
  res.status(202).json({ started: true });
});

// 수집 공고의 진행중/종료 여부를 점검하는 배치. 공고 수만큼 순차 요청이라 수십 초 걸릴 수 있어
// 응답을 기다리지 않고 시작만 알린다(진행 상황은 GET /runs 폴링).
adminRouter.post("/closed-check/run", (req, res) => {
  const userId = req.user!.userId;
  runClosedCheckNow(userId).catch((error) => console.error("[admin] closed check batch failed:", error));
  res.status(202).json({ started: true });
});

adminRouter.get("/favorites", async (req, res) => {
  const all = await getJobPostings(req.user!.userId);
  res.json(all.filter((j) => j.isFavorite === true));
});

const HIDDEN_PAGE_SIZE = 20;

adminRouter.get("/hidden-jobs", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const all = await getHiddenJobs(req.user!.userId);
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
  await permanentDeleteHiddenJobs(req.user!.userId, ids);
  res.json({ success: true });
});

adminRouter.post("/hidden-jobs/purge-all", async (req, res) => {
  await permanentDeleteAllHiddenJobs(req.user!.userId);
  res.json({ success: true });
});

adminRouter.post("/hidden-jobs/:id/restore", async (req, res) => {
  const success = await restoreJob(req.user!.userId, req.params.id);
  if (!success) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({ success: true });
});
