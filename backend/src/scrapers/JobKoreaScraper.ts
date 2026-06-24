import axios from "axios";
import * as cheerio from "cheerio";
import type { JobPosting } from "../types.js";
import type { Scraper } from "./BaseScraper.js";

const BASE_URL = "https://www.jobkorea.co.kr";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const ROLE_SUFFIXES = ["개발자", "엔지니어", "디자이너", "매니저", "기획자"];

// 사람인은 "백엔드/서버개발"처럼 "/"로 구분된 카테고리 표기를 쓰지만, 잡코리아 칩 텍스트는
// "백엔드개발자"처럼 구분자가 없다. matchEngine.rootKeyword가 "/" 또는 공백 앞부분만 비교하므로
// 알려진 직무 접미사 앞에 "/"를 넣어 같은 방식으로 비교되게 한다.
function withRoleSeparator(tag: string): string {
  const suffix = ROLE_SUFFIXES.find((s) => tag.endsWith(s) && tag.length > s.length);
  return suffix ? `${tag.slice(0, -suffix.length)}/${suffix}` : tag;
}

// 칩에는 업종(예: "솔루션·SI·CRM·ERP")이 먼저, 직무 태그가 뒤따라 나온다.
// 직무 접미사가 인식되는 첫 태그를 대표 직무로 삼는다.
function pickRoleCategory(tags: string[]): string | null {
  for (const tag of tags) {
    const normalized = withRoleSeparator(tag);
    if (normalized !== tag) return normalized;
  }
  return tags[0] ?? null;
}

function parseRequiredYears(careerText: string): { min: number; max: number } | null {
  const text = careerText.trim();
  if (text.includes("무관")) return null;

  const atLeastMatch = text.match(/(\d+)\s*년\s*↑/);
  if (atLeastMatch) return { min: Number(atLeastMatch[1]), max: Number(atLeastMatch[1]) + 99 };

  const rangeMatch = text.match(/(\d+)\s*[~\-]\s*(\d+)\s*년/);
  if (rangeMatch) return { min: Number(rangeMatch[1]), max: Number(rangeMatch[2]) };

  const exactMatch = text.match(/(\d+)\s*년/);
  if (exactMatch) return { min: Number(exactMatch[1]), max: Number(exactMatch[1]) };

  return null;
}

// 본문에 "기술 스택" 칸이 없는 공고도 많아, 자유 텍스트에서 흔한 기술명을 직접 찾는다.
const TECH_KEYWORDS = [
  "Java", "Kotlin", "Python", "JavaScript", "TypeScript", "Go", "PHP", "C\\+\\+", "C#",
  "Spring", "Spring Boot", "Django", "Flask", "FastAPI", "Node\\.js", "Express", "NestJS",
  "React", "Vue", "Angular", "Next\\.js",
  "MySQL", "PostgreSQL", "Oracle", "MongoDB", "Redis", "MariaDB", "DynamoDB", "Elasticsearch",
  "AWS", "GCP", "Azure", "Docker", "Kubernetes", "Jenkins", "Linux", "Nginx",
  "Kafka", "RabbitMQ", "GraphQL", "JPA", "MyBatis", "JUnit", "Hadoop", "Spark",
];
const TECH_KEYWORD_RE = new RegExp(`\\b(${TECH_KEYWORDS.join("|")})\\b`, "gi");

// 잡코리아 상세 페이지는 Next.js가 본문을 self.__next_f.push([1, "..."]) 형태의
// RSC 스트림 조각으로 내려준다. 각 조각은 JS 문자열 리터럴이라 JSON.parse로 그대로
// 언이스케이프할 수 있다. 조각을 순서대로 이어붙이면 < 등으로 escape된 본문 HTML이
// 그대로 복원되므로, 청크 참조($16 등)를 따라갈 필요 없이 텍스트만 추출하면 된다.
function extractRscText(html: string): string {
  const pushRe = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let combined = "";
  let match: RegExpExecArray | null;
  while ((match = pushRe.exec(html))) {
    try {
      combined += JSON.parse(`"${match[1]}"`);
    } catch {
      // 일부 조각은 잘려서 올바른 JSON 문자열이 아닐 수 있다. 건너뛴다.
    }
  }
  return combined;
}

function extractDetailSkills(rscText: string): string[] {
  const structured = rscText.match(/<ul class="view-content-detail-skill">(.*?)<\/ul>/s);
  const tagged = structured
    ? [...structured[1].matchAll(/<li>(.*?)<\/li>/g)].map((m) => m[1].trim())
    : [];

  const plainText = rscText.replace(/<[^>]+>/g, " ");
  const keywordHits = [...new Set([...plainText.matchAll(TECH_KEYWORD_RE)].map((m) => m[0]))];

  return [...new Set([...tagged, ...keywordHits])];
}

// 사람인 쪽 deadline 표기("~ 06/26(금)")와 맞춰 프론트엔드 D-day 계산(dday.ts)이
// 그대로 동작하도록 같은 형식으로 변환한다.
function extractDeadline(rscText: string): string | null {
  const match = rscText.match(/"endDate":"(\d{4})\.(\d{2})\.(\d{2})\(([^)]+)\)[^"]*"/);
  if (!match) return null;
  const [, year, month, day, weekday] = match;
  // 상시채용 공고는 실제 마감일 대신 2070년 같은 먼 미래 날짜를 내려준다.
  if (Number(year) > new Date().getFullYear() + 3) return "상시채용";
  return `~ ${month}/${day}(${weekday})`;
}

async function fetchDetail(
  gno: string
): Promise<{ skills: string[]; deadline: string | null } | null> {
  try {
    const response = await axios.get<string>(`${BASE_URL}/Recruit/GI_Read_Comt_Ifrm`, {
      params: { Gno: gno, isHiringCenter: "false", hideMapView: "false" },
      headers: { "User-Agent": USER_AGENT },
      timeout: 15000,
    });
    const rscText = extractRscText(response.data);
    return {
      skills: extractDetailSkills(rscText),
      deadline: extractDeadline(rscText),
    };
  } catch (error) {
    console.warn(`[JobKoreaScraper] detail fetch failed for Gno=${gno}:`, error);
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const JobKoreaScraper: Scraper = {
  canHandle(url: string): boolean {
    return url.includes("jobkorea.co.kr");
  },

  async fetchPostings(
    url: string,
    knownSourceUrls: ReadonlySet<string>
  ): Promise<Omit<JobPosting, "id" | "documents">[]> {
    const response = await axios.get<string>(url, {
      headers: { "User-Agent": USER_AGENT },
      timeout: 20000,
    });
    const $ = cheerio.load(response.data);
    const postings: Omit<JobPosting, "id" | "documents">[] = [];

    $('[data-sentry-component="CardJob"]').each((_, el) => {
      const card = $(el);
      const titleLink = card.find('a[data-sentry-component="Title"]').first();
      const title = titleLink.text().trim();
      const href = titleLink.attr("href");
      if (!title || !href) return;

      const company = card.find("span.text-gray700.text-typo-b2-16").first().text().trim();

      const chips = card
        .find('[data-sentry-component="GrayChip"]')
        .map((__, chip) => $(chip).text().trim())
        .get();
      const location = chips[0] ?? "";
      const tags = chips
        .slice(1)
        .flatMap((chip) => chip.split(","))
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const careerText = card.find("span.flex-shrink-0.text-gray700").first().text().trim();

      // 상세 URL의 조회 출처/검색어 등 추적 파라미터를 제거해, 검색어가 바뀔 때마다
      // 같은 공고가 다른 URL로 잡혀 중복 수집되는 것을 방지한다.
      const sourceUrl = new URL(href, BASE_URL);
      sourceUrl.search = "";

      postings.push({
        sourceUrl: sourceUrl.toString(),
        company,
        title,
        location,
        deadline: null,
        requiredYears: parseRequiredYears(careerText),
        skills: tags,
        roleCategory: pickRoleCategory(tags),
        description: tags.join(", "),
        collectedAt: new Date().toISOString(),
      });
    });

    // 상세 페이지는 공고당 추가 요청이 필요해 무겁다. 이미 수집된 공고는 다시 들어가지
    // 않고, 새 공고만 순차적으로(서버에 부담을 덜 주도록 약간의 지연을 두고) 조회한다.
    for (const posting of postings) {
      if (knownSourceUrls.has(posting.sourceUrl)) continue;

      const gnoMatch = posting.sourceUrl.match(/GI_Read\/(\d+)/);
      if (!gnoMatch) continue;

      const detail = await fetchDetail(gnoMatch[1]);
      if (detail) {
        if (detail.skills.length > 0) {
          posting.skills = [...new Set([...posting.skills, ...detail.skills])];
          posting.description = posting.skills.join(", ");
        }
        if (detail.deadline) {
          posting.deadline = detail.deadline;
        }
      }
      await sleep(250);
    }

    return postings;
  },
};
