import { createHash } from "node:crypto";
import { getCrawlTargetUrls, getImminentThresholdDays, reloadSkillFile } from "../config/skillFileParser.js";
import {
  getHiddenJobs,
  getJobPostings,
  getProfile,
  getPurgedJobHistory,
  purgedJobKey,
  saveJobPostings,
} from "../data/store.js";
import { isMatch } from "../matching/matchEngine.js";
import { findScraperFor } from "../scrapers/index.js";
import type { JobPosting } from "../types.js";
import { daysUntilDeadline } from "../utils/deadline.js";

function idFor(sourceUrl: string): string {
  return createHash("sha1").update(sourceUrl).digest("hex").slice(0, 16);
}

export async function runScrapeAndMatch(): Promise<{
  collected: number;
  newlyMatched: number;
  skillFileWarning?: string;
}> {
  // UPDATE 버튼 클릭(=수집 트리거) 시마다 SKILL.md를 다시 읽어 URL 목록·삭제 기준을 최신화한다.
  const reloadResult = await reloadSkillFile("UPDATE");
  const urls = await getCrawlTargetUrls();
  const thresholdDays = await getImminentThresholdDays();
  const profile = await getProfile();
  const existingJobs = await getJobPostings();
  const existingById = new Map(existingJobs.map((job) => [job.id, job]));
  const knownSourceUrls = new Set(existingJobs.map((job) => job.sourceUrl));
  // 사용자가 영구 삭제한 공고(기업명+제목 일치)는 재수집하지 않는다.
  const purgedKeys = new Set((await getPurgedJobHistory()).map(purgedJobKey));
  // 숨김 처리된 공고도 대시보드에 다시 올리지 않는다 (복원은 관리자 페이지에서만).
  const hiddenJobs = await getHiddenJobs();
  const hiddenIds = new Set(hiddenJobs.map((job) => job.id));
  for (const job of hiddenJobs) knownSourceUrls.add(job.sourceUrl);

  let collected = 0;
  let newlyMatched = 0;
  let purgedSkipped = 0;

  for (const url of urls) {
    const scraper = findScraperFor(url);
    if (!scraper) {
      console.warn(`No scraper registered for URL: ${url}`);
      continue;
    }

    const postings = await scraper.fetchPostings(url, knownSourceUrls);
    collected += postings.length;

    for (const posting of postings) {
      const id = idFor(posting.sourceUrl);
      if (existingById.has(id)) continue;
      if (hiddenIds.has(id)) continue;
      if (purgedKeys.has(purgedJobKey(posting))) {
        purgedSkipped++;
        continue;
      }
      if (!isMatch(profile, posting)) continue;

      const days = daysUntilDeadline(posting.deadline);
      if (days !== null && days <= thresholdDays) continue;

      const job: JobPosting = { ...posting, id, documents: null };
      existingById.set(id, job);
      newlyMatched++;
    }
  }

  if (purgedSkipped > 0) console.log(`[scrape] 영구 삭제 이력 일치로 ${purgedSkipped}건 수집 제외`);
  await saveJobPostings([...existingById.values()]);
  return {
    collected,
    newlyMatched,
    ...(reloadResult.success ? {} : { skillFileWarning: `SKILL.md 재적재 실패: ${reloadResult.error}` }),
  };
}
