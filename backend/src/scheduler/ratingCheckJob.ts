import { updateCompanyRatings } from "../pipeline/updateCompanyRatings.js";
import { runManualJob, updateProgress, type RunRecord } from "./runLog.js";

export const RATING_CHECK_JOB_NAME = "평점조회";

async function ratingCheckTask(): Promise<void> {
  const result = await updateCompanyRatings((progress) => {
    updateProgress(RATING_CHECK_JOB_NAME, progress).catch((error) =>
      console.error("[ratingCheckJob] progress update failed:", error)
    );
  });
  console.log("[ratingCheckJob] rating check:", result);
}

// 대시보드 [UPDATE] 수동 수집(/collect 라우트가 수집 완료 후 호출) + 매일 scrapeTask 직후에
// 실행된다. 자체 cron 스케줄은 없고, 항상 수집 흐름에 이어서 수행된다.
export function runRatingCheckNow(): Promise<RunRecord> {
  return runManualJob(RATING_CHECK_JOB_NAME, ratingCheckTask);
}
