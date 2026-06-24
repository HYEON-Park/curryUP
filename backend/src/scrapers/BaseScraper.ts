import type { JobPosting } from "../types.js";

export interface Scraper {
  canHandle(url: string): boolean;
  // knownSourceUrls: 이미 수집된 공고의 sourceUrl 집합. 상세 페이지까지 들어가야 하는
  // 스크레이퍼가 이미 아는 공고를 매 실행마다 다시 긁지 않도록 건너뛸 때 쓴다.
  fetchPostings(
    url: string,
    knownSourceUrls: ReadonlySet<string>
  ): Promise<Omit<JobPosting, "id" | "documents">[]>;
}
