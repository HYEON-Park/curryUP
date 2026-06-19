import type { JobPosting, JobsPage, UserProfile } from "../types";

const BASE_URL = "http://localhost:4000/api";

export async function fetchProfile(): Promise<UserProfile> {
  const res = await fetch(`${BASE_URL}/profile`);
  return res.json();
}

export async function saveProfile(profile: UserProfile): Promise<UserProfile> {
  const res = await fetch(`${BASE_URL}/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  return res.json();
}

export async function fetchJobs(page: number): Promise<JobsPage> {
  const res = await fetch(`${BASE_URL}/jobs?page=${page}`);
  return res.json();
}

export async function fetchJobDetail(id: string): Promise<JobPosting> {
  const res = await fetch(`${BASE_URL}/jobs/${id}`);
  return res.json();
}
