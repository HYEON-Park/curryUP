import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { JobPosting, UserProfile } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_PATH = path.join(__dirname, "userProfile.json");
const JOBS_PATH = path.join(__dirname, "jobPostings.json");

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
