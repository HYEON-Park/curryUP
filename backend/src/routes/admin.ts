import { Router } from "express";
import { getHiddenJobs, getJobPostings, permanentDeleteAllHiddenJobs, permanentDeleteHiddenJobs, restoreJob } from "../data/store.js";
import { runAiBatchNow } from "../scheduler/aiBatchJob.js";
import { runNotifyNow } from "../scheduler/notifyJob.js";
import { getRunHistory } from "../scheduler/runLog.js";
import { runScrapeNow } from "../scheduler/scrapeJob.js";

export const adminRouter = Router();

adminRouter.get("/runs", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  res.json(await getRunHistory(page));
});

adminRouter.post("/scrape/run", async (req, res) => {
  const scope = req.query.scope === "all" ? "all" : "today";
  res.json(await runScrapeNow(scope));
});

adminRouter.post("/notify/run", async (_req, res) => {
  res.json(await runNotifyNow());
});

// 건당 4~5분, 최대 몇 시간 걸릴 수 있어 응답을 기다리지 않고 즉시 시작만 알린다.
// 진행 상황은 GET /runs 폴링으로 확인한다.
adminRouter.post("/ai/run", (_req, res) => {
  runAiBatchNow().catch((error) => console.error("[admin] AI batch failed:", error));
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
