import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import express from "express";
import { getProfile } from "./data/store.js";
import { notifyWithLink } from "./notify/osNotifier.js";
import { collectRouter } from "./routes/collect.js";
import { profileRouter } from "./routes/profile.js";
import { jobsRouter } from "./routes/jobs.js";
import { catchUpAiBatchJob, startAiBatchJob } from "./scheduler/aiBatchJob.js";
import { catchUpNotifyJob, startNotifyJob } from "./scheduler/notifyJob.js";
import { startScrapeJob } from "./scheduler/scrapeJob.js";

try {
  process.loadEnvFile();
} catch {
  // .env is optional; e.g. OLLAMA_HOST/OLLAMA_MODEL may already be set in the environment
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "../../frontend");

const app = express();
const PORT = process.env.PORT || 4000;
const isProd = process.env.NODE_ENV === "production";

app.use(express.json());

app.use("/api/profile", profileRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/collect", collectRouter);

startScrapeJob();
startNotifyJob();
startAiBatchJob();

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

  // AI 배치 catch-up은 건당 4~5분이 걸릴 수 있으므로 서버 기동(listen)을 막지 않고 백그라운드로 실행한다.
  catchUpNotifyJob().catch((error) => console.error("[catchUpNotifyJob] failed:", error));
  catchUpAiBatchJob().catch((error) => console.error("[catchUpAiBatchJob] failed:", error));

  getProfile().then((profile) => {
    if (profile.lastProfileUpdate === null) {
      notifyWithLink({
        title: "프로필 설정 필요",
        message: "정확한 매칭을 위해 프로필 작성이 필요합니다.",
        url: `http://localhost:${PORT}/profile`,
      });
    }
  });
});
