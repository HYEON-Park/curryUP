import { randomUUID } from "node:crypto";
import { promises as fs, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { todayLocalKey } from "../utils/date.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 실행 이력도 유저별 개별 파일(runLog/{userId}.json)로 분리한다.
const RUN_LOG_DIR = path.join(__dirname, "../data/runLog");
if (!existsSync(RUN_LOG_DIR)) mkdirSync(RUN_LOG_DIR, { recursive: true });

function logPath(userId: string): string {
  return path.join(RUN_LOG_DIR, `${userId}.json`);
}

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

async function readLog(userId: string): Promise<RunRecord[]> {
  try {
    const raw = await fs.readFile(logPath(userId), "utf-8");
    return JSON.parse(raw) as RunRecord[];
  } catch {
    return [];
  }
}

// 매 write마다 오래된 이력을 정리해, 파일이 무한히 커지지 않게 한다.
function pruneOldRecords(log: RunRecord[]): RunRecord[] {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return log.filter((record) => new Date(record.startedAt).getTime() >= cutoff);
}

async function writeLog(userId: string, log: RunRecord[]): Promise<void> {
  await fs.writeFile(logPath(userId), JSON.stringify(pruneOldRecords(log), null, 2), "utf-8");
}

// updateProgress()(fire-and-forget)와 recordRun()의 완료 기록 쓰기가 각자 readLog→writeLog를
// 수행하면서 순서가 섞이면, 늦게 끝나는 쪽이 상대의 쓰기를 덮어써 "running"이 영구 고착될 수 있다.
// 모든 read-modify-write를 이 큐로 직렬화해, 호출 순서대로만 반영되게 한다.
// (배치는 한 번에 유저 1명만 돌고 웹 요청도 유저별이라, 단일 전역 큐로 직렬화해도 충분하다.)
let logMutex: Promise<unknown> = Promise.resolve();
function withLog<T>(userId: string, fn: (log: RunRecord[]) => Promise<T>): Promise<T> {
  const run = logMutex.then(async () => {
    const log = await readLog(userId);
    return fn(log);
  });
  logMutex = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

// 서버가 비정상 종료되면 "running" 상태로 멈춘 레코드가 영원히 남는다.
// 다음 기동 시점에 모든 유저의 그런 레코드를 failed로 정리해, "진행중" 좀비 행을 없앤다.
export async function reconcileInterruptedRuns(): Promise<void> {
  const files = existsSync(RUN_LOG_DIR)
    ? readdirSync(RUN_LOG_DIR).filter((f) => f.endsWith(".json"))
    : [];
  for (const file of files) {
    const userId = file.replace(/\.json$/, "");
    await withLog(userId, async (log) => {
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
      if (changed) await writeLog(userId, log);
    });
  }
}

export async function hasRunToday(userId: string, jobName: string): Promise<boolean> {
  const log = await readLog(userId);
  return log.some((record) => record.jobName === jobName && record.date === todayLocalKey());
}

async function recordRun(
  userId: string,
  jobName: string,
  trigger: RunTrigger,
  task: () => Promise<void>
): Promise<RunRecord> {
  const id = randomUUID();
  const startedAt = new Date().toISOString();
  console.log(`[runLog] ${jobName} 처리 시작 (${trigger}): ${startedAt}`);

  let record: RunRecord = { id, jobName, trigger, date: todayLocalKey(), startedAt, finishedAt: null, status: "running" };
  await withLog(userId, async (log) => {
    log.push(record);
    await writeLog(userId, log);
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

  await withLog(userId, async (log) => {
    const index = log.findIndex((entry) => entry.id === id);
    if (index >= 0) log[index] = record;
    else log.push(record);
    await writeLog(userId, log);
  });

  console.log(`[runLog] ${jobName} 처리 종료: ${record.finishedAt} (${record.status})`);
  return record;
}

// 스케줄러(cron)가 트리거한 실행. 캐치업 로직과 짝을 이룬다.
export function runScheduledJob(userId: string, jobName: string, task: () => Promise<void>): Promise<RunRecord> {
  return recordRun(userId, jobName, "scheduled", task);
}

// 관리자 페이지에서 사용자가 즉시 실행 버튼을 눌러 트리거한 실행.
export function runManualJob(userId: string, jobName: string, task: () => Promise<void>): Promise<RunRecord> {
  return recordRun(userId, jobName, "manual", task);
}

export async function updateProgress(userId: string, jobName: string, progress: RunProgress): Promise<void> {
  await withLog(userId, async (log) => {
    const runningEntries = log.filter((record) => record.jobName === jobName && record.status === "running");
    const latest = runningEntries[runningEntries.length - 1];
    if (!latest) return;
    latest.progress = progress;
    await writeLog(userId, log);
  });
}

export async function isJobRunning(userId: string, jobName: string): Promise<boolean> {
  const log = await readLog(userId);
  return log.some((record) => record.jobName === jobName && record.status === "running");
}

// 특정 배치(jobName)의 가장 최근 실행 레코드를 반환한다. trigger로 수동/자동을 좁힐 수 있다.
// 추천 공고 팝업이 "이번 업데이트 세션"을 식별하는 마커(최근 수동 collect 실행)로 사용한다.
export async function getLatestRun(userId: string, jobName: string, trigger?: RunTrigger): Promise<RunRecord | null> {
  const log = await readLog(userId);
  const filtered = log.filter((r) => r.jobName === jobName && (!trigger || r.trigger === trigger));
  if (filtered.length === 0) return null;
  return filtered.reduce((latest, r) => (r.startedAt > latest.startedAt ? r : latest));
}

export async function getRunHistory(userId: string, page: number, pageSize = 20): Promise<RunHistoryPage> {
  const log = await readLog(userId);
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
  userId: string,
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
  if (await hasRunToday(userId, jobName)) return;

  console.log(`[runLog] ${jobName} 당일 미실행 감지 — 기동 시점에 즉시 실행`);
  await runScheduledJob(userId, jobName, task);
}
