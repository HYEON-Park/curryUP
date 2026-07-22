import axios from "axios";
import * as cheerio from "cheerio";
import type { JobPosting } from "../types.js";
import { resolveDeadlineYear } from "../utils/deadline.js";
import type { Scraper } from "./BaseScraper.js";

const BASE_URL = "https://www.saramin.co.kr";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function parseRequiredYears(careerText: string, title: string): { min: number; max: number } | null {
  const text = careerText.trim();
  const mentionsEntry = text.includes("신입") || title.includes("신입");
  const mentionsExperienced = text.includes("경력") || title.includes("경력");
  // 경력 조건 칸이 "경력무관"처럼 모호해도 제목에 "신입"만 있고 "경력" 언급이 전혀
  // 없으면 신입 전용 채용으로 간주한다. "신입·경력"처럼 함께 쓰인 경우는 경력자도
  // 지원 가능하므로 제한하지 않는다.
  if (mentionsEntry && !mentionsExperienced) return { min: 0, max: 0 };
  if (text.includes("무관")) return null;

  const rangeMatch = text.match(/(\d+)\s*[~\-]\s*(\d+)\s*년/);
  if (rangeMatch) return { min: Number(rangeMatch[1]), max: Number(rangeMatch[2]) };

  const atLeastMatch = text.match(/(\d+)\s*년\s*이상/);
  if (atLeastMatch) return { min: Number(atLeastMatch[1]), max: Number(atLeastMatch[1]) + 99 };

  const exactMatch = text.match(/(\d+)\s*년/);
  if (exactMatch) return { min: Number(exactMatch[1]), max: Number(exactMatch[1]) };

  return null;
}

// 검색결과 한 페이지(40건)만 보면 그 순간 노출된 공고만 잡혀, 사이트에 더 있는
// 공고를 놓친다. 여러 페이지를 순회해 더 폭넓게 모은다.
const MAX_PAGES = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// .job_sector 칩은 업종("웹개발","SI개발")과 직무("백엔드/서버개발")가 뒤섞여 순서가
// 들쭉날쭉해, 첫 칩을 그대로 직무로 쓰면 자주 틀린다. 사람인 직무 카테고리는
// "분야/세부직무" 형식("백엔드/서버개발")으로 표기되므로 "/"가 들어간 칩을 우선한다.
function pickRoleCategory(skills: string[]): string | null {
  return skills.find((tag) => tag.includes("/")) ?? skills[0] ?? null;
}

function parsePage(
  $: cheerio.CheerioAPI
): Omit<JobPosting, "id" | "documents">[] {
  const postings: Omit<JobPosting, "id" | "documents">[] = [];

  $(".item_recruit").each((_, el) => {
    const item = $(el);
    const titleAnchor = item.find(".job_tit a").first();
    const title = (titleAnchor.attr("title") || titleAnchor.text()).trim();
    const href = titleAnchor.attr("href");
    if (!title || !href) return;

    const company = item.find(".corp_name a").first().text().trim();
    // 사람인은 "~ 07/19(금)"처럼 연도 없이 내려주므로, 수집 시점 기준으로 연도를 붙여
    // "~ 2026/07/19(금)" 형식으로 저장한다(상시채용·채용시 등 날짜 아닌 표기는 그대로 유지).
    const rawDeadline = item.find(".job_date .date").first().text().trim() || null;
    const deadline = resolveDeadlineYear(rawDeadline, new Date());

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

    const sourceUrl = new URL(href, BASE_URL);
    // search_uuid는 검색 세션마다 새로 발급되는 추적용 값이라, 같은 공고를 매번 다른 URL로
    // 만들어 중복 수집 방지용 ID(sourceUrl 해시)가 무력화된다. 안정적인 ID를 위해 제거한다.
    sourceUrl.searchParams.delete("search_uuid");

    postings.push({
      sourceUrl: sourceUrl.toString(),
      company,
      title,
      location,
      deadline,
      requiredYears: parseRequiredYears(careerText, title),
      skills,
      roleCategory: pickRoleCategory(skills),
      description: skills.join(", "),
      collectedAt: new Date().toISOString(),
    });
  });

  return postings;
}

export const SaraminScraper: Scraper = {
  canHandle(url: string): boolean {
    return url.includes("saramin.co.kr");
  },

  async fetchPostings(url: string, knownSourceUrls: ReadonlySet<string>): Promise<Omit<JobPosting, "id" | "documents">[]> {
    const postings: Omit<JobPosting, "id" | "documents">[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= MAX_PAGES; page++) {
      const pageUrl = new URL(url);
      pageUrl.searchParams.set("recruitPage", String(page));

      const response = await axios.get<string>(pageUrl.toString(), {
        headers: { "User-Agent": USER_AGENT },
        timeout: 20000,
      });
      const pagePostings = parsePage(cheerio.load(response.data));
      if (pagePostings.length === 0) break;

      let newOnThisPage = 0;
      for (const posting of pagePostings) {
        if (seen.has(posting.sourceUrl)) continue;
        seen.add(posting.sourceUrl);
        postings.push(posting);
        if (!knownSourceUrls.has(posting.sourceUrl)) newOnThisPage++;
      }

      // 이 페이지에 새 공고가 하나도 없으면 이미 아는 영역에 도달한 것이므로 멈춘다.
      if (newOnThisPage === 0) break;
      if (page < MAX_PAGES) await sleep(300);
    }

    return postings;
  },
};
