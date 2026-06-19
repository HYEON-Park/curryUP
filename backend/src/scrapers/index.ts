import type { Scraper } from "./BaseScraper.js";
import { SaraminScraper } from "./SaraminScraper.js";

const scrapers: Scraper[] = [SaraminScraper];

export function findScraperFor(url: string): Scraper | undefined {
  return scrapers.find((scraper) => scraper.canHandle(url));
}
