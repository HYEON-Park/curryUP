import { findScraperFor } from "../scrapers/index.js";
import type { JobPosting } from "../types.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// postingBody가 빈 공고에 상세 본문을 뒤늦게 채운다(대상 배열을 in-place로 수정, 채운 건수 반환).
//
// 왜 필요한가: 상세 본문 조회(fetchPostingBody)는 사람인 스크레이퍼에 나중에 추가됐다. 그 이전에
// 수집돼 postingBody가 빈 기존 공고는 runScrapeAndMatch의 신규 채택 백필(채택 확정 직후 1회)을
// 거치지 못해 상세 뷰에 원문이 없다. 이 함수가 UPDATE 흐름 말미에서 그 공백을 메운다.
//
// 자기 종료형: 이미 본문이 있으면 건너뛰므로, 한 번 채워진 공고는 다음 UPDATE부터 요청하지 않는다.
// 요청은 최초 1회에 몰리고 이후엔 0건에 수렴한다. 사이트 부담을 줄이려 조회 사이에 300ms 쉰다
// (목록 수집과 동일 기준). fetchPostingBody 미구현 스크레이퍼(잡코리아 등)는 자동 스킵된다.
export async function backfillPostingBodies(jobs: JobPosting[]): Promise<number> {
  let filled = 0;
  for (const job of jobs) {
    if (job.postingBody) continue;
    if (job.disabled) continue; // 종료된 공고는 본문 재시도하지 않는다.
    const scraper = findScraperFor(job.sourceUrl);
    if (!scraper?.fetchPostingBody) continue;
    try {
      const body = await scraper.fetchPostingBody(job.sourceUrl);
      if (body) {
        job.postingBody = body;
        filled++;
      }
    } catch (error) {
      console.warn(`[backfill] postingBody 조회 실패 ${job.id}:`, error);
    }
    await sleep(300);
  }
  return filled;
}
