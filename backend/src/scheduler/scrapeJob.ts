import cron from "node-cron";
import { generateMissingDocuments } from "../pipeline/generateMissingDocuments.js";
import { runScrapeAndMatch } from "../pipeline/runScrapeAndMatch.js";

// 매일 00:00~09:00, 매시 정각에 실행 (PRD 3.2)
export function startScrapeJob(): void {
  cron.schedule("0 0-9 * * *", async () => {
    try {
      const matchResult = await runScrapeAndMatch();
      console.log("[scrapeJob] scrape+match:", matchResult);

      const docResult = await generateMissingDocuments();
      console.log("[scrapeJob] document generation:", docResult);
    } catch (error) {
      console.error("[scrapeJob] failed:", error);
    }
  });
}
