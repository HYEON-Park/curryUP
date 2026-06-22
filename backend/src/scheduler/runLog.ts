import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUN_LOG_PATH = path.join(__dirname, "../data/runLog.json");

type RunStatus = "running" | "success" | "failed";

export interface RunProgress {
  total: number;
  completed: number;
  currentTitle: string | null;
}

export interface RunRecord {
  date: string;
  startedAt: string;
  finishedAt: string | null;
  status: RunStatus;
  progress?: RunProgress;
}

type RunLog = Record<string, RunRecord>;

function todayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function readLog(): Promise<RunLog> {
  try {
    const raw = await fs.readFile(RUN_LOG_PATH, "utf-8");
    return JSON.parse(raw) as RunLog;
  } catch {
    return {};
  }
}

async function writeLog(log: RunLog): Promise<void> {
  await fs.writeFile(RUN_LOG_PATH, JSON.stringify(log, null, 2), "utf-8");
}

export async function hasRunToday(jobName: string): Promise<boolean> {
  const log = await readLog();
  return log[jobName]?.date === todayKey();
}

export async function getRunRecord(jobName: string): Promise<RunRecord | undefined> {
  const log = await readLog();
  return log[jobName];
}

export async function updateProgress(jobName: string, progress: RunProgress): Promise<void> {
  const log = await readLog();
  if (!log[jobName]) return;
  log[jobName] = { ...log[jobName], progress };
  await writeLog(log);
}

export async function runDailyJob(jobName: string, task: () => Promise<void>): Promise<void> {
  const startedAt = new Date().toISOString();
  console.log(`[runLog] ${jobName} 처리 시작: ${startedAt}`);

  const log = await readLog();
  log[jobName] = { date: todayKey(), startedAt, finishedAt: null, status: "running" };
  await writeLog(log);

  let status: RunStatus = "success";
  try {
    await task();
  } catch (error) {
    status = "failed";
    console.error(`[runLog] ${jobName} 실패:`, error);
  }

  const finishedAt = new Date().toISOString();
  const finalLog = await readLog();
  finalLog[jobName] = { date: todayKey(), startedAt, finishedAt, status };
  await writeLog(finalLog);
  console.log(`[runLog] ${jobName} 처리 종료: ${finishedAt} (${status})`);
}

export async function catchUpIfMissed(
  jobName: string,
  scheduledHour: number,
  scheduledMinute: number,
  task: () => Promise<void>
): Promise<void> {
  const now = new Date();
  const scheduledPassed =
    now.getHours() > scheduledHour ||
    (now.getHours() === scheduledHour && now.getMinutes() >= scheduledMinute);

  if (!scheduledPassed) return;
  if (await hasRunToday(jobName)) return;

  console.log(`[runLog] ${jobName} 당일 미실행 감지 — 기동 시점에 즉시 실행`);
  await runDailyJob(jobName, task);
}
