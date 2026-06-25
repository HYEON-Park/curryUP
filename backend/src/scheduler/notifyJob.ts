import cron from "node-cron";
import { getProfile } from "../data/store.js";
import { notifyWithLink } from "../notify/osNotifier.js";
import { catchUpIfMissed, runManualJob, runScheduledJob, type RunRecord } from "./runLog.js";

const SCHEDULED_HOUR = 9;
const SCHEDULED_MINUTE = 30;
const PORT = process.env.PORT || 4000;
const JOB_NAME = "notify";

async function notifyTask(force = false): Promise<void> {
  const profile = await getProfile();
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

// 매일 09:30, 당일 00:00~09:29 사이 프로필을 수정하지 않았다면 알림 (PRD 3.3)
export function startNotifyJob(): void {
  cron.schedule(`${SCHEDULED_MINUTE} ${SCHEDULED_HOUR} * * *`, () => runScheduledJob(JOB_NAME, notifyTask));
}

// 백엔드가 09:30 이후에 켜졌고 당일 알림 처리 기록이 없다면 즉시 따라잡는다.
export function catchUpNotifyJob(): Promise<void> {
  return catchUpIfMissed(JOB_NAME, SCHEDULED_HOUR, SCHEDULED_MINUTE, notifyTask);
}

// 관리자 페이지: "오늘 업데이트했는지" 체크를 무시하고 즉시 발송한다.
export function runNotifyNow(): Promise<RunRecord> {
  return runManualJob(JOB_NAME, () => notifyTask(true));
}
