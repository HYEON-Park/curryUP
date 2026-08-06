import cron from "node-cron";
import { getBatchUserId, getJobPostings, saveJobPostings } from "../data/store.js";
import { findScraperFor } from "../scrapers/index.js";
import { attachClosedJobs, runManualJob, runScheduledJob, type RunRecord } from "./runLog.js";
import { withScheduledRetry } from "./scheduledRetry.js";

export const CLOSED_CHECK_JOB_NAME = "종료공고";
const SCHEDULED_HOUR = 19;
const SCHEDULED_MINUTE = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 현재 수집된(disabled 아닌) 공고를 하나씩 사이트에서 확인해, 종료(closed)된 것만 disabled로 표시한다.
// - unknown(판단 불가)·open은 건드리지 않는다(오탐 방지 — 자동 삭제는 하지 않고 사용자가 X로 수동 삭제).
// - 저장은 직전에 파일을 다시 읽어 id 기준 병합한다(서버가 파일을 동시에 쓸 수 있음).
// 종료 처리한 공고 목록을 onClosed로 넘겨 실행 로그(토글 표시)에 붙일 수 있게 한다.
async function closedCheckTask(
  userId: string,
  onClosed: (list: { company: string; title: string }[]) => void
): Promise<void> {
  const jobs = await getJobPostings(userId);
  const targets = jobs.filter((j) => !j.disabled);
  const closed: { company: string; title: string }[] = [];
  const closedAt = new Date().toISOString();

  for (const job of targets) {
    const scraper = findScraperFor(job.sourceUrl);
    if (!scraper?.checkPostingStatus) continue;
    const status = await scraper.checkPostingStatus(job.sourceUrl);
    if (status === "closed") {
      job.disabled = true;
      job.closedAt = closedAt;
      closed.push({ company: job.company, title: job.title });
    }
    await sleep(300);
  }

  if (closed.length > 0) {
    const current = await getJobPostings(userId);
    const byId = new Map(current.map((j) => [j.id, j]));
    for (const job of targets) {
      if (!job.disabled) continue;
      const cur = byId.get(job.id);
      if (cur) {
        cur.disabled = true;
        cur.closedAt = job.closedAt;
      }
    }
    await saveJobPostings(userId, [...byId.values()]);
  }

  console.log(`[closedCheckJob] 점검 ${targets.length}건 중 종료 ${closed.length}건 disabled 처리`);
  onClosed(closed);
}

async function runClosedCheck(userId: string, trigger: "scheduled" | "manual"): Promise<RunRecord> {
  // 한 번의 실행: 배치를 돌리고, 완료 레코드에 종료 목록을 붙인다.
  // (attachClosedJobs는 recordRun의 완료 덮어쓰기 이후여야 유실되지 않는다.)
  const runOnce = async (runner: typeof runManualJob): Promise<RunRecord> => {
    let closedList: { company: string; title: string }[] = [];
    const record = await runner(userId, CLOSED_CHECK_JOB_NAME, () =>
      closedCheckTask(userId, (list) => {
        closedList = list;
      })
    );
    await attachClosedJobs(userId, record.id, closedList);
    return record;
  };

  if (trigger === "manual") return runOnce(runManualJob);

  // 스케줄 실행: 실패 시 5분 뒤 1회 재시도(재시도도 자기 종료 목록을 attach) + 더블 실패 OS 알림.
  const record = await withScheduledRetry(CLOSED_CHECK_JOB_NAME, () => runOnce(runScheduledJob));
  return record!; // 스케줄 실행은 항상 레코드를 반환한다(null은 스킵 전용 — 여기선 발생하지 않음).
}

// 관리자 페이지 "지금 종료 점검" 버튼용.
export function runClosedCheckNow(userId: string): Promise<RunRecord> {
  return runClosedCheck(userId, "manual");
}

// 매일 19:00, 배치 대상 유저 1명(getBatchUserId)의 수집 공고 진행중/종료 여부를 점검한다.
export function startClosedCheckJob(): void {
  cron.schedule(`${SCHEDULED_MINUTE} ${SCHEDULED_HOUR} * * *`, async () => {
    const userId = await getBatchUserId();
    if (!userId) {
      console.log("[closedCheckJob] 배치 대상 유저 없음 — 종료 점검 스케줄 건너뜀");
      return;
    }
    await runClosedCheck(userId, "scheduled");
  });
}
