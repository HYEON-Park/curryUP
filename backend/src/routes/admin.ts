import { Router } from "express";
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
