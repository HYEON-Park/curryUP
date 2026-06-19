import cron from "node-cron";
import notifier from "node-notifier";
import { getProfile } from "../data/store.js";

// 매일 09:30, 당일 00:00~09:29 사이 프로필을 수정하지 않았다면 알림 (PRD 3.3)
export function startNotifyJob(): void {
  cron.schedule("30 9 * * *", async () => {
    try {
      const profile = await getProfile();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const updatedToday = profile.lastProfileUpdate
        ? new Date(profile.lastProfileUpdate) >= todayStart
        : false;

      if (updatedToday) return;

      notifier.notify({
        title: "프로필 업데이트 요청",
        message: "오늘 수집된 공고에 맞춰 프로필 정보를 최신으로 유지해주세요.",
      });
    } catch (error) {
      console.error("[notifyJob] failed:", error);
    }
  });
}
