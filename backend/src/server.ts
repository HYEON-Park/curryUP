import cors from "cors";
import express from "express";
import { profileRouter } from "./routes/profile.js";
import { jobsRouter } from "./routes/jobs.js";
import { startNotifyJob } from "./scheduler/notifyJob.js";
import { startScrapeJob } from "./scheduler/scrapeJob.js";

try {
  process.loadEnvFile();
} catch {
  // .env is optional; e.g. OLLAMA_HOST/OLLAMA_MODEL may already be set in the environment
}

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use("/api/profile", profileRouter);
app.use("/api/jobs", jobsRouter);

startScrapeJob();
startNotifyJob();

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
