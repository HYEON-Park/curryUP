import type { HiddenJobsPage, JobPosting, JobsPage, RunRecord, RunsPage, UserProfile } from "../types";

const BASE_URL = "/api";
const TOKEN_KEY = "authToken";

// ==================== 토큰 저장 (localStorage) ====================

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// 인증이 필요한 모든 요청에 Authorization 헤더를 주입한다. 401이면 토큰을 비우고
// 전역 이벤트를 쏴서(AuthProvider가 수신) 로그인 화면으로 유도한다.
async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event("auth:unauthorized"));
    throw new Error("UNAUTHORIZED");
  }
  return res;
}

function jsonHeaders(): Record<string, string> {
  return { "Content-Type": "application/json" };
}

// ==================== 인증 (auth) ====================

export interface Me {
  userId: string;
  email: string;
  hasProfile: boolean;
}

export async function signup(
  email: string,
  password: string
): Promise<{ needsVerification: boolean; devLink?: string }> {
  const res = await fetch(`${BASE_URL}/auth/signup`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "회원가입에 실패했습니다.");
  }
  return res.json();
}

export async function resendVerification(email: string): Promise<{ devLink?: string }> {
  const res = await fetch(`${BASE_URL}/auth/resend`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ email }),
  });
  return res.json().catch(() => ({}));
}

// 로그인 실패 시 던지는 에러. 이메일 미인증이면 needsVerification 플래그를 붙인다.
export class LoginError extends Error {
  needsVerification: boolean;
  constructor(message: string, needsVerification: boolean) {
    super(message);
    this.needsVerification = needsVerification;
  }
}

export async function login(
  email: string,
  password: string
): Promise<{ token: string; userId: string; email: string; hasProfile: boolean }> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new LoginError(data.error ?? "로그인에 실패했습니다.", Boolean(data.needsVerification));
  }
  return res.json();
}

export async function fetchMe(): Promise<Me> {
  const res = await authFetch(`/auth/me`);
  return res.json();
}

// ==================== 프로필 ====================

export async function fetchProfile(): Promise<UserProfile> {
  const res = await authFetch(`/profile`);
  return res.json();
}

export async function saveProfile(profile: UserProfile): Promise<UserProfile> {
  const res = await authFetch(`/profile`, {
    method: "PUT",
    headers: jsonHeaders(),
    body: JSON.stringify(profile),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "프로필 저장에 실패했습니다.");
  }
  return res.json();
}

// ==================== 공고 ====================

export async function fetchJobs(page: number): Promise<JobsPage> {
  const res = await authFetch(`/jobs?page=${page}`);
  return res.json();
}

// 다중 조건 검색은 전체 페이지를 대상으로 해야 해서, 검색 활성화 시 페이지네이션 없이 전체 목록을 받아온다.
export async function fetchAllJobs(): Promise<{ items: JobPosting[] }> {
  const res = await authFetch(`/jobs/all`);
  return res.json();
}

export async function fetchJobDetail(id: string): Promise<JobPosting> {
  const res = await authFetch(`/jobs/${id}`);
  return res.json();
}

// 공고 상세 페이지: 해당 탭 문서를 사용자가 직접 즉시 생성 요청한다(202로 시작만 알림).
// 진행 중이면 409(BUSY), 프로필 미작성이면 400(NO_PROFILE).
export async function generateJobDocument(id: string, docType: string): Promise<void> {
  const res = await authFetch(`/jobs/${id}/documents/${docType}/generate`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) throw new Error("BUSY");
    throw new Error(data.error ?? "문서 생성 요청에 실패했습니다.");
  }
}

// 생성 상태 폴링. running=false + hasContent면 완료, running=false + !hasContent면 실패.
export async function fetchJobDocStatus(
  id: string,
  docType: string
): Promise<{ running: boolean; hasContent: boolean }> {
  const res = await authFetch(`/jobs/${id}/documents/${docType}/status`);
  return res.json();
}

// 추천 공고 팝업용: 오늘 수집분 중 매칭률 70% 이상 공고와, 업데이트 세션 식별자.
export async function fetchRecommendations(): Promise<{ sessionId: string | null; items: JobPosting[] }> {
  const res = await authFetch(`/jobs/recommendations`);
  return res.json();
}

export async function triggerCollect(): Promise<{ collected: number; newlyMatched: number; skillFileWarning?: string }> {
  const res = await authFetch(`/collect`, { method: "POST" });
  if (!res.ok) throw new Error("수집 요청이 실패했습니다.");
  return res.json();
}

export async function fetchRuns(page: number): Promise<RunsPage> {
  const res = await authFetch(`/admin/runs?page=${page}`);
  return res.json();
}

export async function runScrapeBatch(scope: "today" | "all"): Promise<RunRecord> {
  const res = await authFetch(`/admin/scrape/run?scope=${scope}`, { method: "POST" });
  if (!res.ok) throw new Error("스크래핑 배치 실행에 실패했습니다.");
  return res.json();
}

export async function runNotifyBatch(): Promise<RunRecord> {
  const res = await authFetch(`/admin/notify/run`, { method: "POST" });
  if (!res.ok) throw new Error("알림 배치 실행에 실패했습니다.");
  return res.json();
}

export async function runWriteDocsBatch(): Promise<{ started: boolean }> {
  const res = await authFetch(`/admin/ai/run`, { method: "POST" });
  if (!res.ok) throw new Error("문서 작성 배치 실행에 실패했습니다.");
  return res.json();
}

export async function runRatingCheckBatch(): Promise<{ started: boolean }> {
  const res = await authFetch(`/admin/rating-check/run`, { method: "POST" });
  if (!res.ok) throw new Error("평점 조회 실행에 실패했습니다.");
  return res.json();
}

export async function fetchRatingCheckStatus(): Promise<{ running: boolean }> {
  const res = await authFetch(`/admin/rating-check/status`);
  return res.json();
}

export async function runMatchCheckBatch(): Promise<{ started: boolean }> {
  const res = await authFetch(`/admin/match-check/run`, { method: "POST" });
  if (!res.ok) throw new Error("매칭률 조회 실행에 실패했습니다.");
  return res.json();
}

export async function runClosedCheckBatch(): Promise<{ started: boolean }> {
  const res = await authFetch(`/admin/closed-check/run`, { method: "POST" });
  if (!res.ok) throw new Error("종료 공고 점검 실행에 실패했습니다.");
  return res.json();
}

export async function fetchMatchCheckStatus(): Promise<{ running: boolean }> {
  const res = await authFetch(`/admin/match-check/status`);
  return res.json();
}

export async function deleteJob(id: string): Promise<void> {
  const res = await authFetch(`/jobs/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("삭제 요청이 실패했습니다.");
}

export async function fetchHiddenJobs(page: number): Promise<HiddenJobsPage> {
  const res = await authFetch(`/admin/hidden-jobs?page=${page}`);
  return res.json();
}

export async function restoreHiddenJob(id: string): Promise<void> {
  const res = await authFetch(`/admin/hidden-jobs/${id}/restore`, { method: "POST" });
  if (!res.ok) throw new Error("복구 요청이 실패했습니다.");
}

export async function purgeSelectedHiddenJobs(ids: string[]): Promise<void> {
  const res = await authFetch(`/admin/hidden-jobs/purge-selected`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error("선택 삭제 실패");
}

export async function purgeAllHiddenJobs(): Promise<void> {
  const res = await authFetch(`/admin/hidden-jobs/purge-all`, { method: "POST" });
  if (!res.ok) throw new Error("전체 삭제 실패");
}

export async function toggleFavorite(id: string): Promise<{ isFavorite: boolean }> {
  const res = await authFetch(`/jobs/${id}/favorite`, { method: "PATCH" });
  if (!res.ok) throw new Error("즐겨찾기 변경 실패");
  return res.json();
}

export async function fetchFavoriteJobs(): Promise<JobPosting[]> {
  const res = await authFetch(`/admin/favorites`);
  return res.json();
}
