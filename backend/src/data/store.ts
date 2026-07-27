import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getImminentThresholdDays } from "../config/skillFileParser.js";
import type { HiddenJobPosting, JobPosting, PurgedJobHistoryEntry, UserProfile } from "../types.js";
import { isCollectedToday } from "../utils/date.js";
import { daysUntilDeadline } from "../utils/deadline.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_PATH = path.join(__dirname, "userProfile.json");
const JOBS_PATH = path.join(__dirname, "jobPostings.json");
const HIDDEN_JOBS_PATH = path.join(__dirname, "hiddenJobPostings.json");
const PURGED_HISTORY_PATH = path.join(__dirname, "purgedJobHistory.json");

const DEFAULT_PROFILE: UserProfile = {
  yearsOfExperience: null,
  skills: [],
  careerHistory: "",
  certifications: [],
  locations: [],
  desiredRoleCategories: [],
  roleAnswers: {},
  lastProfileUpdate: null,
};

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function getProfile(): Promise<UserProfile> {
  return readJson(PROFILE_PATH, DEFAULT_PROFILE);
}

export async function saveProfile(profile: UserProfile): Promise<UserProfile> {
  const updated: UserProfile = { ...profile, lastProfileUpdate: new Date().toISOString() };
  await writeJson(PROFILE_PATH, updated);
  return updated;
}

export async function getJobPostings(): Promise<JobPosting[]> {
  return readJson(JOBS_PATH, []);
}

export async function saveJobPostings(jobs: JobPosting[]): Promise<void> {
  await writeJson(JOBS_PATH, jobs);
}

export async function getPurgedJobHistory(): Promise<PurgedJobHistoryEntry[]> {
  return readJson(PURGED_HISTORY_PATH, []);
}

// 사이트마다 법인 표기가 "㈜"/"(주)"로 갈려 같은 공고가 다른 문자열이 되므로, 비교 전에 통일한다.
function normalizeCorpNotation(text: string): string {
  return text.replace(/㈜/g, "(주)").trim();
}

// 기업명+제목 조합 비교용 키. 구분자는 공고 텍스트에 등장하지 않는 NUL 문자를 쓴다.
export function purgedJobKey(job: Pick<JobPosting, "company" | "title">): string {
  return `${normalizeCorpNotation(job.company)}\u0000${normalizeCorpNotation(job.title)}`;
}

// 영구 삭제 시 기업명+제목을 이력에 남긴다. 같은 조합이 이미 있으면 중복 기록하지 않는다.
async function appendPurgedJobHistory(jobs: Pick<JobPosting, "company" | "title">[]): Promise<void> {
  if (jobs.length === 0) return;
  const history = await getPurgedJobHistory();
  const known = new Set(history.map(purgedJobKey));
  const purgedAt = new Date().toISOString();
  for (const job of jobs) {
    if (known.has(purgedJobKey(job))) continue;
    known.add(purgedJobKey(job));
    history.push({ company: job.company, title: job.title, purgedAt });
  }
  await writeJson(PURGED_HISTORY_PATH, history);
}

export async function permanentDeleteHiddenJobs(ids: string[]): Promise<void> {
  const hidden = await getHiddenJobs();
  await appendPurgedJobHistory(hidden.filter((j) => ids.includes(j.id)));
  await writeJson(HIDDEN_JOBS_PATH, hidden.filter((j) => !ids.includes(j.id)));
}

export async function permanentDeleteAllHiddenJobs(): Promise<void> {
  const hidden = await getHiddenJobs();
  await appendPurgedJobHistory(hidden);
  await writeJson(HIDDEN_JOBS_PATH, []);
}

export async function getHiddenJobs(): Promise<HiddenJobPosting[]> {
  return readJson(HIDDEN_JOBS_PATH, []);
}

// 공고 삭제 시 연관된 생성 문서(자기소개서/경력기술서 등)도 함께 삭제한다.
export async function hideJob(id: string): Promise<boolean> {
  const jobs = await getJobPostings();
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx === -1) return false;
  const [job] = jobs.splice(idx, 1);
  await saveJobPostings(jobs);
  const hidden = await getHiddenJobs();
  hidden.unshift({ ...job, documents: null, hiddenAt: new Date().toISOString() });
  await writeJson(HIDDEN_JOBS_PATH, hidden);
  return true;
}

export async function restoreJob(id: string): Promise<boolean> {
  const hidden = await getHiddenJobs();
  const idx = hidden.findIndex((j) => j.id === id);
  if (idx === -1) return false;
  const hiddenJob = hidden[idx];
  hidden.splice(idx, 1);
  await writeJson(HIDDEN_JOBS_PATH, hidden);
  const { hiddenAt: _, ...job } = hiddenJob;
  const jobs = await getJobPostings();
  jobs.push(job);
  await saveJobPostings(jobs);
  return true;
}

// 관리자 페이지: 오늘 수집된 공고만 지워서 재수집 시 깨끗하게 다시 쌓이게 한다.
export async function deleteTodaysJobPostings(): Promise<void> {
  const jobs = await getJobPostings();
  const remaining = jobs.filter((job) => !isCollectedToday(job.collectedAt));
  await saveJobPostings(remaining);
}

// 서버 기동 시: SKILL.md의 "마감 임박 공고 자동 삭제" 기준(D-N) 이내인 공고를 즉시 제거한다.
export async function deleteImminentJobPostings(): Promise<void> {
  const jobs = await getJobPostings();
  const thresholdDays = await getImminentThresholdDays();
  const remaining = jobs.filter((j) => {
    const days = daysUntilDeadline(j.deadline);
    return days === null || days > thresholdDays;
  });
  if (remaining.length < jobs.length) {
    console.log(`[store] 마감임박 공고 ${jobs.length - remaining.length}건 제거`);
    await saveJobPostings(remaining);
  }
}

// 마감일 판정은 daysUntilDeadline 한 곳으로 통일한다(연도 포함 표기를 그대로 신뢰).
// "상시채용"/null처럼 날짜가 없는 공고는 daysUntilDeadline이 null을 주므로 만료 대상에서 제외된다.
function isPastDeadline(job: JobPosting): boolean {
  const days = daysUntilDeadline(job.deadline);
  return days !== null && days < 0;
}

// 데일리 배치: D-day(마감일)가 지난 공고는 더 이상 지원 대상이 아니므로 정리한다.
export async function toggleFavorite(id: string): Promise<boolean | null> {
  const jobs = await getJobPostings();
  const job = jobs.find((j) => j.id === id);
  if (!job) return null;
  job.isFavorite = !job.isFavorite;
  await saveJobPostings(jobs);
  return !!job.isFavorite;
}

export async function deleteExpiredJobPostings(): Promise<void> {
  const jobs = await getJobPostings();
  const remaining = jobs.filter((job) => !isPastDeadline(job));
  await saveJobPostings(remaining);
}
