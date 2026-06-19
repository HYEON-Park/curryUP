import axios from "axios";
import * as cheerio from "cheerio";
import type { JobPosting } from "../types.js";
import type { Scraper } from "./BaseScraper.js";

const BASE_URL = "https://www.saramin.co.kr";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function parseRequiredYears(careerText: string): { min: number; max: number } | null {
  const text = careerText.trim();
  if (text.includes("신입")) return { min: 0, max: 0 };
  if (text.includes("무관")) return null;

  const rangeMatch = text.match(/(\d+)\s*[~\-]\s*(\d+)\s*년/);
  if (rangeMatch) return { min: Number(rangeMatch[1]), max: Number(rangeMatch[2]) };

  const atLeastMatch = text.match(/(\d+)\s*년\s*이상/);
  if (atLeastMatch) return { min: Number(atLeastMatch[1]), max: Number(atLeastMatch[1]) + 99 };

  const exactMatch = text.match(/(\d+)\s*년/);
  if (exactMatch) return { min: Number(exactMatch[1]), max: Number(exactMatch[1]) };

  return null;
}

export const SaraminScraper: Scraper = {
  canHandle(url: string): boolean {
    return url.includes("saramin.co.kr");
  },

  async fetchPostings(url: string): Promise<Omit<JobPosting, "id" | "documents">[]> {
    const response = await axios.get<string>(url, {
      headers: { "User-Agent": USER_AGENT },
      timeout: 20000,
    });
    const $ = cheerio.load(response.data);
    const postings: Omit<JobPosting, "id" | "documents">[] = [];

    $(".item_recruit").each((_, el) => {
      const item = $(el);
      const titleAnchor = item.find(".job_tit a").first();
      const title = (titleAnchor.attr("title") || titleAnchor.text()).trim();
      const href = titleAnchor.attr("href");
      if (!title || !href) return;

      const company = item.find(".corp_name a").first().text().trim();
      const deadline = item.find(".job_date .date").first().text().trim() || null;

      const conditionSpans = item.find(".job_condition > span");
      const location = conditionSpans
        .eq(0)
        .find("a")
        .map((__, a) => $(a).text().trim())
        .get()
        .join(" ");
      const careerText = conditionSpans.eq(1).text().trim();

      const skills = item
        .find(".job_sector a")
        .map((__, a) => $(a).text().trim())
        .get()
        .filter((text) => text.length > 0);

      postings.push({
        sourceUrl: new URL(href, BASE_URL).toString(),
        company,
        title,
        location,
        deadline,
        requiredYears: parseRequiredYears(careerText),
        skills,
        roleCategory: skills[0] ?? null,
        description: skills.join(", "),
        collectedAt: new Date().toISOString(),
      });
    });

    return postings;
  },
};
