import { Router } from "express";
import { runScrapeAndMatch } from "../pipeline/runScrapeAndMatch.js";
import { runManualJob } from "../scheduler/runLog.js";

export const collectRouter = Router();
const JOB_NAME = "collect";

// 문서 생성(건당 4~5분)은 23:00 AI 배치(aiBatchJob)에서 일괄 처리한다.
// 여기서 동시에 트리거하면 배치와 동시에 jobPostings.json을 써서 데이터가 덮어써질 수 있어 분리해둔다.
collectRouter.post("/", async (_req, res) => {
  let result: Awaited<ReturnType<typeof runScrapeAndMatch>> | undefined;
  const record = await runManualJob(JOB_NAME, async () => {
    result = await runScrapeAndMatch();
  });
  if (record.status === "failed") {
    console.error("[manual collect] failed:", record.error);
    res.status(500).json({ error: "수집 중 오류가 발생했습니다." });
    return;
  }
  res.json(result);
});
