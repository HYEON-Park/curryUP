import type { HiddenJobsPage, JobPosting, JobsPage, RunRecord, RunsPage, UserProfile } from "../types";

const BASE_URL = "/api";

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

export async function triggerCollect(): Promise<{ collected: number; newlyMatched: number }> {
  const res = await fetch(`${BASE_URL}/collect`, { method: "POST" });
  if (!res.ok) throw new Error("수집 요청이 실패했습니다.");
  return res.json();
}

export async function fetchRuns(page: number): Promise<RunsPage> {
  const res = await fetch(`${BASE_URL}/admin/runs?page=${page}`);
  return res.json();
}

export async function runScrapeBatch(scope: "today" | "all"): Promise<RunRecord> {
  const res = await fetch(`${BASE_URL}/admin/scrape/run?scope=${scope}`, { method: "POST" });
  if (!res.ok) throw new Error("스크래핑 배치 실행에 실패했습니다.");
  return res.json();
}

export async function runNotifyBatch(): Promise<RunRecord> {
  const res = await fetch(`${BASE_URL}/admin/notify/run`, { method: "POST" });
  if (!res.ok) throw new Error("알림 배치 실행에 실패했습니다.");
  return res.json();
}

export async function runAiBatch(): Promise<{ started: boolean }> {
  const res = await fetch(`${BASE_URL}/admin/ai/run`, { method: "POST" });
  if (!res.ok) throw new Error("AI 배치 실행에 실패했습니다.");
  return res.json();
}

export async function deleteJob(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/jobs/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("삭제 요청이 실패했습니다.");
}

export async function fetchHiddenJobs(page: number): Promise<HiddenJobsPage> {
  const res = await fetch(`${BASE_URL}/admin/hidden-jobs?page=${page}`);
  return res.json();
}

export async function restoreHiddenJob(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/admin/hidden-jobs/${id}/restore`, { method: "POST" });
  if (!res.ok) throw new Error("복구 요청이 실패했습니다.");
}

export async function purgeSelectedHiddenJobs(ids: string[]): Promise<void> {
  const res = await fetch(`${BASE_URL}/admin/hidden-jobs/purge-selected`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error("선택 삭제 실패");
}

export async function purgeAllHiddenJobs(): Promise<void> {
  const res = await fetch(`${BASE_URL}/admin/hidden-jobs/purge-all`, { method: "POST" });
  if (!res.ok) throw new Error("전체 삭제 실패");
}

export async function toggleFavorite(id: string): Promise<{ isFavorite: boolean }> {
  const res = await fetch(`${BASE_URL}/jobs/${id}/favorite`, { method: "PATCH" });
  if (!res.ok) throw new Error("즐겨찾기 변경 실패");
  return res.json();
}

export async function fetchFavoriteJobs(): Promise<JobPosting[]> {
  const res = await fetch(`${BASE_URL}/admin/favorites`);
  return res.json();
}
