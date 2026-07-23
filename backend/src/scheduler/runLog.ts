import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUN_LOG_PATH = path.join(__dirname, "../data/runLog.json");

// 관리자 페이지 실행 이력 보존 기간.
const RETENTION_DAYS = 20;

export type RunTrigger = "scheduled" | "manual";
type RunStatus = "running" | "success" | "failed";

export interface RunProgress {
  total: number;
  completed: number;
  currentTitle: string | null;
}

export interface RunRecord {
  id: string;
  jobName: string;
  trigger: RunTrigger;
  date: string;
  startedAt: string;
  finishedAt: string | null;
  status: RunStatus;
  error?: string;
  progress?: RunProgress;
}

export interface RunHistoryPage {
  items: RunRecord[];
  page: number;
  totalPages: number;
  totalItems: number;
}

function todayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function readLog(): Promise<RunRecord[]> {
  try {
    const raw = await fs.readFile(RUN_LOG_PATH, "utf-8");
    return JSON.parse(raw) as RunRecord[];
  } catch {
    return [];
  }
}

// 매 write마다 오래된 이력을 정리해, runLog.json이 무한히 커지지 않게 한다.
function pruneOldRecords(log: RunRecord[]): RunRecord[] {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return log.filter((record) => new Date(record.startedAt).getTime() >= cutoff);
}

async function writeLog(log: RunRecord[]): Promise<void> {
  await fs.writeFile(RUN_LOG_PATH, JSON.stringify(pruneOldRecords(log), null, 2), "utf-8");
}

// updateProgress()(fire-and-forget)와 recordRun()의 완료 기록 쓰기가 각자 readLog→writeLog를
// 수행하면서 순서가 섞이면, 늦게 끝나는 쪽이 상대의 쓰기를 덮어써 "running"이 영구 고착될 수 있다.
// 모든 read-modify-write를 이 큐로 직렬화해, 호출 순서대로만 반영되게 한다.
let logMutex: Promise<unknown> = Promise.resolve();
function withLog<T>(fn: (log: RunRecord[]) => Promise<T>): Promise<T> {
  const run = logMutex.then(async () => {
    const log = await readLog();
    return fn(log);
  });
  logMutex = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

// 서버가 비정상 종료되면 "running" 상태로 멈춘 레코드가 영원히 남는다.
// 다음 기동 시점에 그런 레코드를 failed로 정리해, 관리자 페이지에 좀비 "진행중" 행이 보이지 않게 한다.
// 기동 직후 catch-up 배치의 기록 쓰기와 겹칠 수 있으므로, 다른 쓰기와 동일하게 withLog 큐를 거친다.
export async function reconcileInterruptedRuns(): Promise<void> {
  await withLog(async (log) => {
    const now = new Date().toISOString();
    let changed = false;
    for (const record of log) {
      if (record.status === "running") {
        record.status = "failed";
        record.finishedAt = now;
        record.error = "서버 재시작으로 중단됨";
        changed = true;
      }
    }
    if (changed) await writeLog(log);
  });
}

export async function hasRunToday(jobName: string): Promise<boolean> {
  const log = await readLog();
  return log.some((record) => record.jobName === jobName && record.date === todayKey());
}

async function recordRun(jobName: string, trigger: RunTrigger, task: () => Promise<void>): Promise<RunRecord> {
  const id = randomUUID();
  const startedAt = new Date().toISOString();
  console.log(`[runLog] ${jobName} 처리 시작 (${trigger}): ${startedAt}`);

  let record: RunRecord = { id, jobName, trigger, date: todayKey(), startedAt, finishedAt: null, status: "running" };
  await withLog(async (log) => {
    log.push(record);
    await writeLog(log);
  });

  try {
    await task();
    record = { ...record, status: "success" };
  } catch (error) {
    record = {
      ...record,
      status: "failed",
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    };
    console.error(`[runLog] ${jobName} 실패:`, error);
  }
  record.finishedAt = new Date().toISOString();

  await withLog(async (log) => {
    const index = log.findIndex((entry) => entry.id === id);
    if (index >= 0) log[index] = record;
    else log.push(record);
    await writeLog(log);
  });

  console.log(`[runLog] ${jobName} 처리 종료: ${record.finishedAt} (${record.status})`);
  return record;
}

// 스케줄러(cron)가 트리거한 실행. 캐치업 로직과 짝을 이룬다.
export function runScheduledJob(jobName: string, task: () => Promise<void>): Promise<RunRecord> {
  return recordRun(jobName, "scheduled", task);
}

// 관리자 페이지에서 사용자가 즉시 실행 버튼을 눌러 트리거한 실행.
export function runManualJob(jobName: string, task: () => Promise<void>): Promise<RunRecord> {
  return recordRun(jobName, "manual", task);
}

export async function updateProgress(jobName: string, progress: RunProgress): Promise<void> {
  await withLog(async (log) => {
    const runningEntries = log.filter((record) => record.jobName === jobName && record.status === "running");
    const latest = runningEntries[runningEntries.length - 1];
    if (!latest) return;
    latest.progress = progress;
    await writeLog(log);
  });
}

export async function isJobRunning(jobName: string): Promise<boolean> {
  const log = await readLog();
  return log.some((record) => record.jobName === jobName && record.status === "running");
}

// 특정 배치(jobName)의 가장 최근 실행 레코드를 반환한다. trigger로 수동/자동을 좁힐 수 있다.
// 추천 공고 팝업이 "이번 업데이트 세션"을 식별하는 마커(최근 수동 collect 실행)로 사용한다.
export async function getLatestRun(jobName: string, trigger?: RunTrigger): Promise<RunRecord | null> {
  const log = await readLog();
  const filtered = log.filter((r) => r.jobName === jobName && (!trigger || r.trigger === trigger));
  if (filtered.length === 0) return null;
  return filtered.reduce((latest, r) => (r.startedAt > latest.startedAt ? r : latest));
}

export async function getRunHistory(page: number, pageSize = 20): Promise<RunHistoryPage> {
  const log = await readLog();
  const sorted = [...log].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const start = (page - 1) * pageSize;
  return {
    items: sorted.slice(start, start + pageSize),
    page,
    totalPages: Math.max(1, Math.ceil(sorted.length / pageSize)),
    totalItems: sorted.length,
  };
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
  await runScheduledJob(jobName, task);
}
