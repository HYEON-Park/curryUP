import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_MD_PATH = path.join(__dirname, "..", "..", "..", "SKILL.md");

// 서버 기동 시 최초 1회, 이후 UPDATE 버튼(수집 트리거) 클릭 시마다 재적재된다.
// 재적재 실패 시에도 서버는 멈추지 않고 직전 캐시(없으면 빈 배열)를 유지한다.
let cachedUrls: string[] | null = null;

// "마감 임박 공고 자동 삭제" 섹션의 D-N 표기 중 최댓값을 삭제 기준일로 사용한다.
// 섹션이 없거나 D-N 표기를 찾지 못하면 기본값을 사용한다.
const DEFAULT_IMMINENT_THRESHOLD_DAYS = 2;
let cachedImminentThresholdDays: number | null = null;

function parseUrls(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- http"))
    .map((line) => line.slice(2).trim());
}

function parseImminentThresholdDays(raw: string): number | null {
  const matches = [...raw.matchAll(/D-(\d+)/g)].map((m) => Number(m[1]));
  if (matches.length === 0) return null;
  return Math.max(...matches);
}

export async function reloadSkillFile(): Promise<{ success: boolean; count?: number; error?: string }> {
  let raw: string;
  try {
    raw = await fs.readFile(SKILL_MD_PATH, "utf-8");
  } catch {
    const message = `SKILL.md not found at ${SKILL_MD_PATH}`;
    console.warn(`[skillFileParser] ${message}`);
    if (cachedUrls === null) cachedUrls = [];
    return { success: false, error: message };
  }

  try {
    const urls = parseUrls(raw);
    cachedUrls = urls;

    const threshold = parseImminentThresholdDays(raw);
    if (threshold === null) {
      console.warn(
        `[skillFileParser] "마감 임박 공고 자동 삭제" 기준(D-N)을 찾지 못해 기본값(D-${DEFAULT_IMMINENT_THRESHOLD_DAYS})을 사용합니다.`
      );
      if (cachedImminentThresholdDays === null) cachedImminentThresholdDays = DEFAULT_IMMINENT_THRESHOLD_DAYS;
    } else {
      cachedImminentThresholdDays = threshold;
    }

    console.log(
      `[skillFileParser] SKILL.md reloaded: ${urls.length} target URL(s), imminent threshold D-${cachedImminentThresholdDays}`
    );
    return { success: true, count: urls.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[skillFileParser] Failed to parse SKILL.md: ${message}`);
    if (cachedUrls === null) cachedUrls = [];
    if (cachedImminentThresholdDays === null) cachedImminentThresholdDays = DEFAULT_IMMINENT_THRESHOLD_DAYS;
    return { success: false, error: message };
  }
}

export async function getCrawlTargetUrls(): Promise<string[]> {
  if (cachedUrls === null) {
    await reloadSkillFile();
  }
  return cachedUrls ?? [];
}

export async function getImminentThresholdDays(): Promise<number> {
  if (cachedImminentThresholdDays === null) {
    await reloadSkillFile();
  }
  return cachedImminentThresholdDays ?? DEFAULT_IMMINENT_THRESHOLD_DAYS;
}
