import axios from "axios";
import * as cheerio from "cheerio";
import type { JobPosting } from "../types.js";
import type { PostingStatus, Scraper } from "./BaseScraper.js";

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

function parseRequiredYears(careerText: string, title: string): { min: number; max: number } | null {
  const text = careerText.trim();
  const mentionsEntry = text.includes("신입") || title.includes("신입");
  const mentionsExperienced = text.includes("경력") || title.includes("경력");
  // 경력 조건 칸이 "경력무관"처럼 모호해도 제목에 "신입"만 있고 "경력" 언급이 전혀
  // 없으면 신입 전용 채용으로 간주한다. "신입·경력"처럼 함께 쓰인 경우는 경력자도
  // 지원 가능하므로 제한하지 않는다.
  if (mentionsEntry && !mentionsExperienced) return { min: 0, max: 0 };
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

// deadline은 연도 포함 형식("~ 2026/06/26(금)")으로 저장한다. endDate에 실제 연도가 있으므로
// 그대로 사용한다(연도를 붙여야 D-day 계산이 과거를 내년으로 밀지 않는다).
function extractDeadline(rscText: string): string | null {
  const match = rscText.match(/"endDate":"(\d{4})\.(\d{2})\.(\d{2})\(([^)]+)\)[^"]*"/);
  if (!match) return null;
  const [, year, month, day, weekday] = match;
  // 상시채용 공고는 실제 마감일 대신 2070년 같은 먼 미래 날짜를 내려준다.
  if (Number(year) > new Date().getFullYear() + 3) return "상시채용";
  return `~ ${year}/${month}/${day}(${weekday})`;
}

const RESPONSIBILITIES_MAX_LENGTH = 2000;
// '공고' 탭에 원문 전체를 보여주기 위한 별도 컷. responsibilities(매칭·문서 배치용 요약)보다 길게 잡는다.
const POSTING_BODY_MAX_LENGTH = 8000;

// 회사마다 공고 본문 템플릿(일반 단락, 카드형, 표 기반 등)이 전부 달라서 "담당업무"
// 같은 특정 제목 태그를 정규식으로 찾는 방식은 회사별로 깨진다. 대신 RSC 조각 중
// 한글 비중이 높고 HTML 태그를 포함한(=실제 본문이 들어있는) 조각을 찾아 태그만
// 벗겨내면 템플릿과 무관하게 본문 텍스트를 얻을 수 있다. 길이 제한 없이 반환한다.
function extractBodyText(html: string): string | null {
  const pushRe = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let match: RegExpExecArray | null;
  let bestChunk = "";

  while ((match = pushRe.exec(html))) {
    let decoded: string;
    try {
      decoded = JSON.parse(`"${match[1]}"`);
    } catch {
      continue;
    }
    const koreanCount = (decoded.match(/[가-힣]/g) || []).length;
    const hasHtml = /<(p|div|table|br|li)[\s>]/i.test(decoded);
    if (koreanCount > 80 && hasHtml && decoded.length > bestChunk.length) bestChunk = decoded;
  }

  if (!bestChunk) return null;

  const text = bestChunk
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");

  return text || null;
}

// 공고 진행/마감은 눈에 보이는 문구·버튼(클라이언트 렌더)이 아니라 RSC 데이터의
// statusType 값으로만 확실히 구분된다(실측: 마감="CLOSE", 진행="POSTING").
// "상시채용"이어도 실제로 내려가면 statusType이 CLOSE로 바뀐다. 추천공고 블록에는
// 이 키가 없어 본문(메인 공고) 값만 잡힌다 — 첫 매치를 사용한다.
function extractStatusType(html: string): "CLOSE" | "POSTING" | null {
  const pushRe = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let match: RegExpExecArray | null;
  while ((match = pushRe.exec(html))) {
    let decoded: string;
    try {
      decoded = JSON.parse(`"${match[1]}"`);
    } catch {
      continue;
    }
    const m = decoded.match(/"statusType"\s*:\s*"(CLOSE|POSTING)"/);
    if (m) return m[1] as "CLOSE" | "POSTING";
  }
  return null;
}

async function fetchDetail(
  gno: string
): Promise<{ skills: string[]; deadline: string | null; responsibilities: string | null; postingBody: string | null } | null> {
  try {
    const response = await axios.get<string>(`${BASE_URL}/Recruit/GI_Read_Comt_Ifrm`, {
      params: { Gno: gno, isHiringCenter: "false", hideMapView: "false" },
      headers: { "User-Agent": USER_AGENT },
      timeout: 15000,
    });
    const rscText = extractRscText(response.data);
    const body = extractBodyText(response.data);
    return {
      skills: extractDetailSkills(rscText),
      deadline: extractDeadline(rscText),
      responsibilities: body ? body.slice(0, RESPONSIBILITIES_MAX_LENGTH) : null,
      postingBody: body ? body.slice(0, POSTING_BODY_MAX_LENGTH) : null,
    };
  } catch (error) {
    console.warn(`[JobKoreaScraper] detail fetch failed for Gno=${gno}:`, error);
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 검색결과 한 페이지만 보면 그 순간 노출된 공고만 잡혀, 사이트에 더 있는 공고를
// 놓친다. 여러 페이지를 순회해 더 폭넓게 모은다.
const MAX_PAGES = 5;

function parsePage($: cheerio.CheerioAPI): Omit<JobPosting, "id" | "documents">[] {
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
      requiredYears: parseRequiredYears(careerText, title),
      skills: tags,
      roleCategory: pickRoleCategory(tags),
      description: tags.join(", "),
      collectedAt: new Date().toISOString(),
    });
  });

  return postings;
}

export const JobKoreaScraper: Scraper = {
  canHandle(url: string): boolean {
    return url.includes("jobkorea.co.kr");
  },

  async fetchPostings(
    url: string,
    knownSourceUrls: ReadonlySet<string>
  ): Promise<Omit<JobPosting, "id" | "documents">[]> {
    const postings: Omit<JobPosting, "id" | "documents">[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= MAX_PAGES; page++) {
      const pageUrl = new URL(url);
      pageUrl.searchParams.set("Page_No", String(page));

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
        if (detail.responsibilities) {
          posting.responsibilities = detail.responsibilities;
        }
        if (detail.postingBody) {
          posting.postingBody = detail.postingBody;
        }
      }
      await sleep(250);
    }

    return postings;
  },

  // GI_Read 페이지의 RSC 데이터 statusType으로 판정한다(실측: 마감=CLOSE, 진행=POSTING).
  // Ifrm 본문은 마감이어도 200+본문을 그대로 줘서 신호로 못 쓴다(실측 확인). 눈에 보이는
  // "마감"·마감버튼은 클라이언트 렌더라 서버 HTML에 없고, "마감" 문자열은 정상 공고에도 있다.
  // 5xx(내려간 공고)는 closed, statusType을 못 찾으면 unknown(유지)으로 둔다.
  async checkPostingStatus(sourceUrl: string): Promise<PostingStatus> {
    const gnoMatch = sourceUrl.match(/GI_Read\/(\d+)/);
    if (!gnoMatch) return "unknown";
    try {
      const response = await axios.get<string>(`${BASE_URL}/Recruit/GI_Read/${gnoMatch[1]}`, {
        headers: { "User-Agent": USER_AGENT },
        timeout: 15000,
        validateStatus: () => true,
      });
      if (response.status >= 500) return "closed";
      if (response.status >= 200 && response.status < 300) {
        const statusType = extractStatusType(response.data);
        if (statusType === "CLOSE") return "closed";
        if (statusType === "POSTING") return "open";
      }
      return "unknown";
    } catch {
      return "unknown";
    }
  },
};
