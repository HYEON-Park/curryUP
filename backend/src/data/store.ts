import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { HiddenJobPosting, JobPosting, UserProfile } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_PATH = path.join(__dirname, "userProfile.json");
const JOBS_PATH = path.join(__dirname, "jobPostings.json");
const HIDDEN_JOBS_PATH = path.join(__dirname, "hiddenJobPostings.json");

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

export async function getHiddenJobs(): Promise<HiddenJobPosting[]> {
  return readJson(HIDDEN_JOBS_PATH, []);
}

export async function hideJob(id: string): Promise<boolean> {
  const jobs = await getJobPostings();
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx === -1) return false;
  const [job] = jobs.splice(idx, 1);
  await saveJobPostings(jobs);
  const hidden = await getHiddenJobs();
  hidden.unshift({ ...job, hiddenAt: new Date().toISOString() });
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
  const todayKey = new Date().toISOString().slice(0, 10);
  const remaining = jobs.filter((job) => job.collectedAt.slice(0, 10) !== todayKey);
  await saveJobPostings(remaining);
}

// deadline 표기("~ 07/05(일)")는 연도가 없어, 수집 시점(collectedAt)을 기준으로 가장
// 가까운 미래로 연도를 보정한 뒤 실제 마감일을 구한다. "상시채용"/null처럼 날짜가
// 없는 공고는 마감 기준이 없으므로 만료 대상에서 제외한다.
function isPastDeadline(job: JobPosting, now: Date): boolean {
  if (!job.deadline) return false;
  const match = job.deadline.match(/(\d{1,2})\/(\d{1,2})/);
  if (!match) return false;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const collected = new Date(job.collectedAt);
  collected.setHours(0, 0, 0, 0);

  let resolvedDeadline = new Date(collected.getFullYear(), month - 1, day);
  if (resolvedDeadline < collected) resolvedDeadline = new Date(collected.getFullYear() + 1, month - 1, day);

  return resolvedDeadline < now;
}

// 데일리 배치: D-day(마감일)가 지난 공고는 더 이상 지원 대상이 아니므로 정리한다.
export async function deleteExpiredJobPostings(): Promise<void> {
  const jobs = await getJobPostings();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const remaining = jobs.filter((job) => !isPastDeadline(job, now));
  await saveJobPostings(remaining);
}
