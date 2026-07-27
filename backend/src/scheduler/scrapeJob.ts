import cron from "node-cron";
import {
  deleteExpiredJobPostings,
  deleteImminentJobPostings,
  deleteTodaysJobPostings,
  saveJobPostings,
} from "../data/store.js";
import { runScrapeAndMatch } from "../pipeline/runScrapeAndMatch.js";
import { runRatingCheckNow } from "./ratingCheckJob.js";
import { runManualJob, runScheduledJob, type RunRecord } from "./runLog.js";
import { runWriteDocumentsIfNeeded } from "./writeDocumentsJob.js";

const SCHEDULED_HOUR = 21;
const SCHEDULED_MINUTE = 0;
const JOB_NAME = "scrape";

async function scrapeTask(): Promise<void> {
  await deleteExpiredJobPostings();
  // D-N 경계는 날짜 단위로만 바뀌므로, 서버 기동 시 정리에 더해 매일 배치에서도 한 번 더 정리한다
  // (서버가 며칠씩 재시작 없이 떠 있어도 마감임박 공고가 계속 걸러지도록).
  await deleteImminentJobPostings();
  const matchResult = await runScrapeAndMatch();
  console.log("[scrapeJob] scrape+match:", matchResult);
  // 수집 이후 기업 평점 체크를 무조건 이어서 수행한다.
  // (UPDATE 버튼 흐름은 collect 라우트 + 프런트의 별도 평점 호출로 처리되므로 여기와 중복되지 않는다.)
  await runRatingCheckNow();
  // 평점 체크 종료 후: 신규 공고·미작성 즐겨찾기 공고가 있으면 Claude 문서 작성 배치를 무조건 실행한다.
  await runWriteDocumentsIfNeeded();
}

// 매일 22:00 한 번, D-day 지난 공고를 정리하고 새 공고를 수집+매칭한 뒤 평점 갱신 → 문서 작성까지 이어서 수행한다.
// AI 문서 생성은 Claude Code(.claude/skills/write-documents)가 담당한다.
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
