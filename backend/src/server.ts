import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import express from "express";
import { reloadSkillFile } from "./config/skillFileParser.js";
import { deleteImminentJobPostings, getBatchUserId } from "./data/store.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { collectRouter } from "./routes/collect.js";
import { profileRouter } from "./routes/profile.js";
import { jobsRouter } from "./routes/jobs.js";
// AI 문서 생성은 Claude Code가 담당한다 (.claude/skills/write-documents). 매일 08:00 별도 크론
// (startWriteDocumentsJob)이 당일 수집분에 대해 실행하고, 관리자 페이지의 수동 실행 버튼은
// admin.ts의 POST /ai/run(runWriteDocumentsIfNeeded)로 이어진다.
import { startClosedCheckJob } from "./scheduler/closedCheckJob.js";
import { catchUpNotifyJob, startNotifyJob } from "./scheduler/notifyJob.js";
import { reconcileInterruptedRuns } from "./scheduler/runLog.js";
import { startScrapeJob } from "./scheduler/scrapeJob.js";
import { startWriteDocumentsJob } from "./scheduler/writeDocumentsJob.js";

try {
  process.loadEnvFile();
} catch {
  // .env is optional; env vars may already be set in the environment
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "../../frontend");

const app = express();
const PORT = process.env.PORT || 4000;
const isProd = process.env.NODE_ENV === "production";

app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/collect", collectRouter);
app.use("/api/admin", adminRouter);

// 애플리케이션 최초 부트스트랩 단계(서버 기동/재기동 시 공통)에서 SKILL.md를 재적재한다.
await reloadSkillFile("STARTUP");

startScrapeJob();
startNotifyJob();
startClosedCheckJob();
startWriteDocumentsJob();

const server = http.createServer(app);

if (isProd) {
  const distDir = path.join(frontendRoot, "dist");
  app.use(express.static(distDir));
  app.get("*", (_req, res) => res.sendFile(path.join(distDir, "index.html")));
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root: frontendRoot,
    server: { middlewareMode: true, hmr: { server } },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);

  // 직전 종료가 비정상적이었다면 "running"으로 멈춰있는 이력을 failed로 정리한다(전체 유저).
  reconcileInterruptedRuns().catch((error) => console.error("[reconcileInterruptedRuns] failed:", error));

  // 기동 시점에 오늘·내일 마감 공고를 즉시 정리한다(배치 대상 유저 1명 기준).
  getBatchUserId()
    .then((userId) => (userId ? deleteImminentJobPostings(userId) : undefined))
    .catch((error) => console.error("[deleteImminentJobPostings] failed:", error));

  catchUpNotifyJob().catch((error) => console.error("[catchUpNotifyJob] failed:", error));
});
