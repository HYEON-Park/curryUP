import cron from "node-cron";
import { runScrapeAndMatch } from "../pipeline/runScrapeAndMatch.js";

// 매일 00:00~09:00, 매시 정각에 수집+매칭만 실행 (PRD 3.2).
// AI 문서 생성은 CPU 추론 부담 때문에 분리되어 23:00 배치(aiBatchJob)에서 일괄 처리한다.
export function startScrapeJob(): void {
  cron.schedule("0 0-9 * * *", async () => {
    try {
      const matchResult = await runScrapeAndMatch();
      console.log("[scrapeJob] scrape+match:", matchResult);
    } catch (error) {
      console.error("[scrapeJob] failed:", error);
    }
  });
}
