import type { JobPosting } from "../types.js";

export interface Scraper {
  canHandle(url: string): boolean;
  fetchPostings(url: string): Promise<Omit<JobPosting, "id" | "documents">[]>;
}
