import { createHash } from "node:crypto";
import { getCrawlTargetUrls } from "../config/skillFileParser.js";
import { getJobPostings, getProfile, saveJobPostings } from "../data/store.js";
import { isMatch } from "../matching/matchEngine.js";
import { findScraperFor } from "../scrapers/index.js";
import type { JobPosting } from "../types.js";

function idFor(sourceUrl: string): string {
  return createHash("sha1").update(sourceUrl).digest("hex").slice(0, 16);
}

export async function runScrapeAndMatch(): Promise<{ collected: number; newlyMatched: number }> {
  const urls = await getCrawlTargetUrls();
  const profile = await getProfile();
  const existingJobs = await getJobPostings();
  const existingById = new Map(existingJobs.map((job) => [job.id, job]));

  let collected = 0;
  let newlyMatched = 0;

  for (const url of urls) {
    const scraper = findScraperFor(url);
    if (!scraper) {
      console.warn(`No scraper registered for URL: ${url}`);
      continue;
    }

    const postings = await scraper.fetchPostings(url);
    collected += postings.length;

    for (const posting of postings) {
      const id = idFor(posting.sourceUrl);
      if (existingById.has(id)) continue;
      if (!isMatch(profile, posting)) continue;

      const job: JobPosting = { ...posting, id, documents: null };
      existingById.set(id, job);
      newlyMatched++;
    }
  }

  await saveJobPostings([...existingById.values()]);
  return { collected, newlyMatched };
}
