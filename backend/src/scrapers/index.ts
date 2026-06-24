import type { Scraper } from "./BaseScraper.js";
import { SaraminScraper } from "./SaraminScraper.js";
import { JobKoreaScraper } from "./JobKoreaScraper.js";

const scrapers: Scraper[] = [SaraminScraper, JobKoreaScraper];

export function findScraperFor(url: string): Scraper | undefined {
  return scrapers.find((scraper) => scraper.canHandle(url));
}
