import cron from "node-cron";
import { getBatchUserId, getProfile } from "../data/store.js";
import { notifyWithLink } from "../notify/osNotifier.js";
import { catchUpIfMissed, runManualJob, runScheduledJob, type RunRecord } from "./runLog.js";
import { withScheduledRetry } from "./scheduledRetry.js";

const SCHEDULED_HOUR = 9;
const SCHEDULED_MINUTE = 0;
const PORT = process.env.PORT || 4000;
const JOB_NAME = "notify";

async function notifyTask(userId: string, force = false): Promise<void> {
  const profile = await getProfile(userId);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const updatedToday = profile.lastProfileUpdate
    ? new Date(profile.lastProfileUpdate) >= todayStart
    : false;

  if (updatedToday && !force) return;

  notifyWithLink({
    title: "프로필 업데이트 요청",
    message: "오늘 수집된 공고에 맞춰 프로필 정보를 최신으로 유지해주세요.",
    url: `http://localhost:${PORT}/profile`,
  });
}

// 매일 09:00, 당일 00:00~08:59 사이 프로필을 수정하지 않았다면 알림.
// 대상은 "가장 최근 로그인 + 프로필 충족" 유저 1명(getBatchUserId). 대상이 없으면 건너뛴다.
export function startNotifyJob(): void {
  cron.schedule(`${SCHEDULED_MINUTE} ${SCHEDULED_HOUR} * * *`, async () => {
    const userId = await getBatchUserId();
    if (!userId) return;
    await withScheduledRetry(JOB_NAME, () => runScheduledJob(userId, JOB_NAME, () => notifyTask(userId)));
  });
}

// 백엔드가 09:00 이후에 켜졌고 당일 알림 처리 기록이 없다면 즉시 따라잡는다.
export async function catchUpNotifyJob(): Promise<void> {
  const userId = await getBatchUserId();
  if (!userId) return;
  await catchUpIfMissed(userId, JOB_NAME, SCHEDULED_HOUR, SCHEDULED_MINUTE, () => notifyTask(userId));
}

// 관리자 페이지: "오늘 업데이트했는지" 체크를 무시하고 즉시 발송한다(로그인 유저 기준).
export function runNotifyNow(userId: string): Promise<RunRecord> {
  return runManualJob(userId, JOB_NAME, () => notifyTask(userId, true));
}
