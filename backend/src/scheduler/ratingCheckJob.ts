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

// 대시보드에서 [UPDATE] 버튼을 누르면 공고 수집 뒤 이어서 즉시 실행되는 수동 배치. 주기적 스케줄링은 없다.
export function runRatingCheckNow(): Promise<RunRecord> {
  return runManualJob(RATING_CHECK_JOB_NAME, ratingCheckTask);
}
