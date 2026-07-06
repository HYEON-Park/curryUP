import cron from "node-cron";
import {
  deleteExpiredJobPostings,
  deleteImminentJobPostings,
  deleteTodaysJobPostings,
  saveJobPostings,
} from "../data/store.js";
import { runScrapeAndMatch } from "../pipeline/runScrapeAndMatch.js";
import { runManualJob, runScheduledJob, type RunRecord } from "./runLog.js";

const SCHEDULED_HOUR = 0;
const SCHEDULED_MINUTE = 0;
const JOB_NAME = "scrape";

async function scrapeTask(): Promise<void> {
  await deleteExpiredJobPostings();
  // D-N 경계는 날짜 단위로만 바뀌므로, 서버 기동 시 정리에 더해 매일 자정에도 한 번 더 정리한다
  // (서버가 며칠씩 재시작 없이 떠 있어도 마감임박 공고가 계속 걸러지도록).
  await deleteImminentJobPostings();
  const matchResult = await runScrapeAndMatch();
  console.log("[scrapeJob] scrape+match:", matchResult);
}

// 매일 00:00 한 번, D-day 지난 공고를 정리하고 새 공고를 수집+매칭한다 (PRD 3.2).
// AI 문서 생성은 CPU 추론 부담 때문에 분리되어 23:00 배치(aiBatchJob)에서 일괄 처리한다.
export function startScrapeJob(): void {
  cron.schedule(`${SCHEDULED_MINUTE} ${SCHEDULED_HOUR} * * *`, () => runScheduledJob(JOB_NAME, scrapeTask));
}

// 관리자 페이지: 기존 데이터를 초기화한 뒤 지금 바로 재수집한다.
export function runScrapeNow(scope: "today" | "all"): Promise<RunRecord> {
  return runManualJob(JOB_NAME, async () => {
    if (scope === "today") await deleteTodaysJobPostings();
    else await saveJobPostings([]);
    await scrapeTask();
  });
}
