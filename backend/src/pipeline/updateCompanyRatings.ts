import { getCompanyRatings } from "../crawler/jobplanetCrawler.js";
import { getJobPostings, saveJobPostings } from "../data/store.js";

export interface RatingProgress {
  total: number;
  completed: number;
  currentTitle: string | null;
}

// 같은 회사가 여러 공고에 걸쳐 있어도 잡플래닛 조회는 회사당 한 번만 수행한다.
// targetCompanies가 주어지면 그 회사들만 조회한다(매칭률 ≥60% 필터 등). null/미지정이면 전체.
export async function updateCompanyRatings(
  userId: string,
  onProgress?: (progress: RatingProgress) => void,
  targetCompanies?: Set<string> | null
): Promise<{ updated: number; failed: number }> {
  const jobs = await getJobPostings(userId);
  const regionByCompany = new Map<string, string>();
  for (const job of jobs) {
    if (targetCompanies && !targetCompanies.has(job.company)) continue;
    if (!regionByCompany.has(job.company)) regionByCompany.set(job.company, job.location);
  }
  const lookups = [...regionByCompany.entries()].map(([company, region]) => ({ company, region }));

  let updated = 0;
  let failed = 0;

  await getCompanyRatings(lookups, async (result, index) => {
    onProgress?.({ total: lookups.length, completed: index, currentTitle: result.company });
    for (const job of jobs) {
      if (job.company === result.company) {
        job.rating = result.rating;
        job.ratingUpdatedAt = result.crawledAt;
      }
    }
    result.rating ? updated++ : failed++;
    await saveJobPostings(userId, jobs);
  });
  onProgress?.({ total: lookups.length, completed: lookups.length, currentTitle: null });

  return { updated, failed };
}
