import { getJobPostings } from "../data/store.js";
import { updateCompanyRatings } from "../pipeline/updateCompanyRatings.js";
import { isCollectedToday } from "../utils/date.js";
import { matchOverallPercent } from "../utils/matchReport.js";
import { runManualJob, updateProgress, type RunRecord } from "./runLog.js";

export const RATING_CHECK_JOB_NAME = "평점조회";

// 평점 조회 대상: 오늘 수집 + 매칭률(종합) 60% 이상인 공고의 회사만.
// 배치 순서상 매칭률조회 이후 실행되므로 documents.matchReport가 채워져 있다.
const MIN_MATCH_PERCENT = 60;

async function ratingCheckTask(userId: string): Promise<void> {
  const jobs = await getJobPostings(userId);
  const targetCompanies = new Set<string>();
  for (const j of jobs) {
    if (!isCollectedToday(j.collectedAt)) continue;
    const pct = matchOverallPercent(j.documents?.matchReport);
    if (pct !== null && pct >= MIN_MATCH_PERCENT) targetCompanies.add(j.company);
  }
  if (targetCompanies.size === 0) {
    console.log("[ratingCheckJob] 오늘 수집분 중 매칭률 60% 이상 공고 없음 — 평점 조회 대상 없음");
  }
  const result = await updateCompanyRatings(
    userId,
    (progress) => {
      updateProgress(userId, RATING_CHECK_JOB_NAME, progress).catch((error) =>
        console.error("[ratingCheckJob] progress update failed:", error)
      );
    },
    targetCompanies
  );
  console.log("[ratingCheckJob] rating check(오늘 ≥60%):", result);
}

// 대시보드 [UPDATE] 수동 수집(/collect 라우트가 수집 완료 후 호출) + 매일 scrapeTask 직후에
// 실행된다. 자체 cron 스케줄은 없고, 항상 수집 흐름에 이어서 수행된다.
export function runRatingCheckNow(userId: string): Promise<RunRecord> {
  return runManualJob(userId, RATING_CHECK_JOB_NAME, () => ratingCheckTask(userId));
}
