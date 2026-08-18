import cron from "node-cron";
import { sendUpdateCompleteEmail } from "../auth/mailer.js";
import {
  deleteExpiredJobPostings,
  deleteImminentJobPostings,
  deleteTodaysJobPostings,
  findUserById,
  getBatchUserIds,
  hasProfile,
  saveJobPostings,
} from "../data/store.js";
import { runScrapeAndMatch } from "../pipeline/runScrapeAndMatch.js";
import { getRecommendations } from "../utils/recommendations.js";
import { runMatchCheckIfNeeded } from "./matchCheckJob.js";
import { runRatingCheckNow } from "./ratingCheckJob.js";
import { runManualJob, runScheduledJob, type RunRecord } from "./runLog.js";
import { withScheduledRetry } from "./scheduledRetry.js";

const SCHEDULED_HOUR = 20;
const SCHEDULED_MINUTE = 0;
const JOB_NAME = "scrape";

async function scrapeTask(userId: string): Promise<void> {
  // 프로필이 없으면 매칭 기준이 없어 스크래핑·매칭·문서 작성을 건너뛴다(오전 알림 배치는 대상 아님).
  if (!(await hasProfile(userId))) {
    console.log("[scrapeJob] 프로필 미작성 — 스크래핑 배치 건너뜀");
    return;
  }
  await deleteExpiredJobPostings(userId);
  // D-N 경계는 날짜 단위로만 바뀌므로, 서버 기동 시 정리에 더해 매일 배치에서도 한 번 더 정리한다
  // (서버가 며칠씩 재시작 없이 떠 있어도 마감임박 공고가 계속 걸러지도록).
  await deleteImminentJobPostings(userId);
  const matchResult = await runScrapeAndMatch(userId);
  console.log("[scrapeJob] scrape+match:", matchResult);
  // 대시보드 "공고 UPDATE" 버튼(collect 라우트)과 동일한 자동화 순서로 이어서 수행한다:
  // 수집 → 매칭률 조회(Claude) → 평점 조회(매칭률 60% 이상 공고의 회사만). 문서 작성 배치는 이 배치에서 실행하지 않는다.
  await runMatchCheckIfNeeded(userId);
  // 매칭률 산정 후, 오늘 수집분 중 매칭률 60% 이상 공고의 회사만 평점 조회한다.
  await runRatingCheckNow(userId);
  // UPDATE 완료 시 해당 사용자 이메일로 완료 알림 메일을 보낸다(발송 실패는 배치를 막지 않음).
  // 오늘의 추천 공고(매칭률 70% 이상)가 있으면 메일에 함께 싣는다.
  const user = await findUserById(userId);
  if (user?.email) {
    const { items } = await getRecommendations(userId);
    await sendUpdateCompleteEmail(user.email, {
      collected: matchResult.collected,
      newlyMatched: matchResult.newlyMatched,
    }, items).catch((error) => console.error("[scrapeJob] UPDATE 완료 메일 발송 실패:", error));
  }
}

// 매일 07:00 한 번, D-day 지난 공고를 정리하고 새 공고를 수집+매칭한 뒤 평점 조회 → 매칭률 조회까지
// 이어서 수행한다(대시보드 "공고 UPDATE" 버튼과 동일한 자동화 흐름).
// 이후 08:00에는 별도 크론(writeDocumentsJob)이 당일 수집분 문서 작성 배치를 실행한다.
// 배치 대상은 관리자가 등록한 유저 전부(getBatchUserIds). 사용자별 순차로 돈다(CLI 1개씩). 대상이 없으면 건너뛴다.
export function startScrapeJob(): void {
  cron.schedule(`${SCHEDULED_MINUTE} ${SCHEDULED_HOUR} * * *`, async () => {
    const userIds = await getBatchUserIds();
    if (userIds.length === 0) {
      console.log("[scrapeJob] 배치 대상 유저 없음 — 스크래핑 스케줄 건너뜀");
      return;
    }
    for (const userId of userIds) {
      await withScheduledRetry(JOB_NAME, () => runScheduledJob(userId, JOB_NAME, () => scrapeTask(userId)));
    }
  });
}

// 관리자 페이지: 기존 데이터를 초기화한 뒤 지금 바로 재수집한다(로그인 유저 본인 데이터 대상).
export function runScrapeNow(userId: string, scope: "today" | "all"): Promise<RunRecord> {
  return runManualJob(userId, JOB_NAME, async () => {
    if (scope === "today") await deleteTodaysJobPostings(userId);
    else await saveJobPostings(userId, []);
    await scrapeTask(userId);
  });
}
