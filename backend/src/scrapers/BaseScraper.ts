import type { JobPosting } from "../types.js";

// 공고 진행 상태. "unknown"은 판단 불가(일시 오류 등)로, 절대 종료 처리하지 않는다(오탐 방지).
export type PostingStatus = "open" | "closed" | "unknown";

export interface Scraper {
  canHandle(url: string): boolean;
  // knownSourceUrls: 이미 수집된 공고의 sourceUrl 집합. 상세 페이지까지 들어가야 하는
  // 스크레이퍼가 이미 아는 공고를 매 실행마다 다시 긁지 않도록 건너뛸 때 쓴다.
  fetchPostings(
    url: string,
    knownSourceUrls: ReadonlySet<string>
  ): Promise<Omit<JobPosting, "id" | "documents">[]>;
  // 개별 공고가 아직 진행중인지(사이트에 살아있는지) 확인한다. 종료공고 배치가 매일 호출한다.
  // 미구현 스크레이퍼는 종료 판정에서 제외된다(대상 공고 유지).
  checkPostingStatus?(sourceUrl: string): Promise<PostingStatus>;
}
