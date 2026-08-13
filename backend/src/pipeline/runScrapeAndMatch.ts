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
import { backfillPostingBodies } from "./backfillPostingBody.js";
import { findScraperFor } from "../scrapers/index.js";
import type { JobPosting } from "../types.js";
import { daysUntilDeadline } from "../utils/deadline.js";

function idFor(sourceUrl: string): string {
  return createHash("sha1").update(sourceUrl).digest("hex").slice(0, 16);
}

// 공고 출처 판별(중복 제거용). sourceUrl 도메인으로 사람인/잡코리아를 구분한다.
function jobSource(sourceUrl: string): "saramin" | "jobkorea" | "other" {
  if (sourceUrl.includes("saramin.co.kr")) return "saramin";
  if (sourceUrl.includes("jobkorea.co.kr")) return "jobkorea";
  return "other";
}

// 회사명 정규화(㈜·(주)·주식회사·공백 제거) — 표기 차이로 같은 회사를 놓치지 않도록.
function normalizeCompany(name: string): string {
  return name.replace(/㈜|\(주\)|주식회사|\s+/g, "").trim();
}

export async function runScrapeAndMatch(userId: string): Promise<{
  collected: number;
  newlyMatched: number;
  skillFileWarning?: string;
}> {
  // UPDATE 버튼 클릭(=수집 트리거) 시마다 SKILL.md를 다시 읽어 URL 목록·삭제 기준을 최신화한다.
  const reloadResult = await reloadSkillFile("UPDATE");
  const urls = await getCrawlTargetUrls();
  const thresholdDays = await getImminentThresholdDays();
  const profile = await getProfile(userId);
  const existingJobs = await getJobPostings(userId);
  const existingById = new Map(existingJobs.map((job) => [job.id, job]));
  const knownSourceUrls = new Set(existingJobs.map((job) => job.sourceUrl));
  // 사용자가 영구 삭제한 공고(기업명+제목 일치)는 재수집하지 않는다.
  const purgedKeys = new Set((await getPurgedJobHistory(userId)).map(purgedJobKey));
  // 숨김 처리된 공고도 대시보드에 다시 올리지 않는다 (복원은 관리자 페이지에서만).
  const hiddenJobs = await getHiddenJobs(userId);
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

      // 여기까지 통과 = 채택 확정. 채택된 신규 공고에만 상세 본문을 백필한다(요청 수 최소화).
      // 목록 수집 단계에서 이미 본문을 채운 스크레이퍼(잡코리아)는 postingBody가 있으므로 건너뛴다.
      // 본문 메서드가 없는 스크레이퍼(옵셔널 미구현)는 옵셔널 호출로 자동 스킵된다.
      if (!posting.postingBody && scraper.fetchPostingBody) {
        const body = await scraper.fetchPostingBody(posting.sourceUrl);
        if (body) posting.postingBody = body;
      }

      const job: JobPosting = { ...posting, id, documents: null };
      existingById.set(id, job);
      newlyMatched++;
    }
  }

  if (purgedSkipped > 0) console.log(`[scrape] 영구 삭제 이력 일치로 ${purgedSkipped}건 수집 제외`);

  let finalJobs = [...existingById.values()];

  // 사람인·잡코리아에 같은 회사가 겹치면 사람인 공고만 남기고 잡코리아 공고는 삭제한다(정규화 비교).
  // (전체 목록 대상 — 기존분 포함해서 매 수집마다 정리)
  const saraminCompanies = new Set<string>();
  for (const j of finalJobs) {
    if (jobSource(j.sourceUrl) === "saramin") saraminCompanies.add(normalizeCompany(j.company));
  }
  const beforeDedup = finalJobs.length;
  finalJobs = finalJobs.filter(
    (j) => !(jobSource(j.sourceUrl) === "jobkorea" && saraminCompanies.has(normalizeCompany(j.company)))
  );
  const dedupRemoved = beforeDedup - finalJobs.length;
  if (dedupRemoved > 0) console.log(`[scrape] 사람인 중복 회사의 잡코리아 공고 ${dedupRemoved}건 삭제`);

  // 마감임박(D-thresholdDays 이하) 공고는 전량 삭제한다. 신규는 위(line ~76)에서 이미 수집 제외하지만,
  // 이미 목록에 있던 공고도 매 수집마다 함께 정리한다(상시채용·마감일 없음은 유지).
  const beforeImminent = finalJobs.length;
  finalJobs = finalJobs.filter((j) => {
    const days = daysUntilDeadline(j.deadline);
    return days === null || days > thresholdDays;
  });
  const imminentRemoved = beforeImminent - finalJobs.length;
  if (imminentRemoved > 0) console.log(`[scrape] 마감임박(D-${thresholdDays} 이하) 공고 ${imminentRemoved}건 삭제`);

  // 본문 없는 기존 공고 백필: 신규 채택 백필(위)은 이번에 새로 추가된 공고만 거친다.
  // fetchPostingBody가 나중에 추가된 스크레이퍼(사람인) 탓에, 그 전에 수집돼 postingBody가 빈
  // 기존 공고는 상세 뷰에 원문이 없다. 매 UPDATE마다 채워 넣는다(자기 종료형 — §backfillPostingBody).
  const backfilled = await backfillPostingBodies(finalJobs);
  if (backfilled > 0) console.log(`[scrape] 기존 공고 postingBody 백필 ${backfilled}건`);

  await saveJobPostings(userId, finalJobs);
  return {
    collected,
    newlyMatched,
    ...(reloadResult.success ? {} : { skillFileWarning: `SKILL.md 재적재 실패: ${reloadResult.error}` }),
  };
}
