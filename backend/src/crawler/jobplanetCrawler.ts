import { chromium, type Page } from "playwright";

export interface JobplanetRatingResult {
  company: string;
  rating: string | null;
  crawledAt: string;
}

export interface CompanyLookup {
  company: string;
  // 공고에 명시된 근무 지역 (예: "서울 강남구"). 동명이인 회사가 여러 건 검색될 때
  // 지역이 일치하는 후보를 고르는 2차 필터링에 사용한다.
  region?: string;
}

interface CompanyCandidate {
  name: string;
  rating: string | null;
  regionText: string;
}

const RATING_PATTERN = /^\d\.\d$/;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
// 검색 결과 카드 하나하나를 회사명(h4)을 기준점으로 찾은 뒤, 그 안에서 평점/지역을 상대 조회한다.
const NAME_SELECTOR = "h4.line-clamp-1";
const RATING_SELECTOR = 'div.flex.items-center > span.ml-\\[2px\\].text-gray-800';
const REGION_SELECTOR = "div.ml-\\[16px\\].text-gray-400";

// 채용 공고의 회사명에는 "㈜"/"(주)"/"주식회사" 같은 법인 표기가 붙는데, 잡플래닛 검색은
// 이 표기가 있으면 결과를 못 찾는 경우가 많다 (예: "㈜CJ올리브네트웍스" 실패 / "CJ올리브네트웍스" 성공).
function normalizeCompanyName(company: string): string {
  return company
    .replace(/^(주식회사\s*|\(주\)\s*|㈜\s*)/, "")
    .replace(/(\s*㈜|\s*\(주\)|\s*주식회사)$/, "")
    .trim();
}

// "서울 강남구" -> "서울"
function regionTokenFromLocation(location: string): string | null {
  return location.trim().split(/\s+/)[0] || null;
}

// 잡플래닛 카드의 지역 텍스트는 "IT/웹/통신∙부산" 형태로, 업종과 지역이 ∙로 이어져 있다.
function regionTokenFromCandidateText(regionText: string): string | null {
  const parts = regionText.split("∙");
  return parts[parts.length - 1]?.trim() || null;
}

async function scrapeRating(page: Page, { company, region }: CompanyLookup): Promise<JobplanetRatingResult> {
  const crawledAt = new Date().toISOString();
  try {
    const query = normalizeCompanyName(company) || company;
    await page.goto(`https://www.jobplanet.co.kr/search/companies?query=${encodeURIComponent(query)}`, {
      waitUntil: "networkidle",
    });

    const candidates: CompanyCandidate[] = await page.evaluate(
      ({ nameSelector, ratingSelector, regionSelector }) => {
        return Array.from(document.querySelectorAll(nameSelector)).map((nameEl) => {
          const container = nameEl.parentElement;
          return {
            name: nameEl.textContent?.trim() ?? "",
            rating: container?.querySelector(ratingSelector)?.textContent?.trim() ?? null,
            regionText: container?.querySelector(regionSelector)?.textContent?.trim() ?? "",
          };
        });
      },
      { nameSelector: NAME_SELECTOR, ratingSelector: RATING_SELECTOR, regionSelector: REGION_SELECTOR }
    );

    // 후방 와일드카드(%회사명%)로 인해 "캠버" 검색에 "캠버스"가 걸리는 문제를 막기 위해,
    // 법인 표기를 뗀 이름이 검색어와 정확히 일치하는 후보만 남긴다.
    const exactMatches = candidates.filter((c) => normalizeCompanyName(c.name) === query);

    let chosen: CompanyCandidate | undefined;
    if (exactMatches.length <= 1) {
      chosen = exactMatches[0];
    } else {
      // 동명 회사가 여러 건이면 공고의 근무 지역과 일치하는 후보를 우선한다.
      const jobRegion = region ? regionTokenFromLocation(region) : null;
      const regionMatch = jobRegion
        ? exactMatches.find((c) => regionTokenFromCandidateText(c.regionText) === jobRegion)
        : undefined;
      chosen = regionMatch ?? exactMatches[0];
    }

    const raw = chosen?.rating ?? null;
    const rating = raw && RATING_PATTERN.test(raw) ? raw : null;
    return { company, rating, crawledAt };
  } catch (error) {
    console.error(`[jobplanetCrawler] ${company} 크롤링 실패:`, error);
    return { company, rating: null, crawledAt };
  }
}

export async function getCompanyRating(company: string, region?: string): Promise<JobplanetRatingResult> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ "User-Agent": USER_AGENT });
    return await scrapeRating(page, { company, region });
  } finally {
    await browser.close();
  }
}

// 배치 갱신용: 회사마다 브라우저를 새로 띄우면 느려지므로 브라우저 하나를 재사용한다.
export async function getCompanyRatings(
  lookups: CompanyLookup[],
  onEach?: (result: JobplanetRatingResult, index: number) => Promise<void> | void
): Promise<JobplanetRatingResult[]> {
  const browser = await chromium.launch({ headless: true });
  const results: JobplanetRatingResult[] = [];
  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ "User-Agent": USER_AGENT });
    for (let i = 0; i < lookups.length; i++) {
      const result = await scrapeRating(page, lookups[i]);
      results.push(result);
      await onEach?.(result, i);
    }
  } finally {
    await browser.close();
  }
  return results;
}
