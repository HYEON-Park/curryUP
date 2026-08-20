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

export type UserRole = "USER" | "ADMIN";

export interface Me {
  userId: string;
  email: string;
  hasProfile: boolean;
  role: UserRole;
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
): Promise<{ token: string; userId: string; email: string; hasProfile: boolean; role: UserRole }> {
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

// 비밀번호 재설정 요청. 계정 존재 여부를 노출하지 않으려 서버는 항상 성공으로 응답한다.
// SMTP 미설정(개발) 시 devLink가 실려 온다.
export async function forgotPassword(email: string): Promise<{ devLink?: string }> {
  const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ email }),
  });
  return res.json().catch(() => ({}));
}

// 재설정 토큰 + 새 비밀번호로 변경한다. 실패 시 서버 메시지로 에러를 던진다.
export async function resetPassword(token: string, password: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/auth/reset-password`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "비밀번호 재설정에 실패했습니다.");
  }
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

// PDF 이력서를 업로드해 폼 주입용 파싱 결과(부분 UserProfile)를 받는다.
// 원본 PDF를 application/pdf 바이너리로 전송한다(base64 없이 File 그대로).
export async function parseResumePdf(file: File): Promise<Partial<UserProfile>> {
  const res = await authFetch(`/profile/parse-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: file,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "PDF 파싱에 실패했습니다.");
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

// 배치 대상 등록: 가입 유저 목록(이메일·등록 여부·프로필 충족 여부)을 불러온다.
export interface BatchCandidate {
  userId: string;
  email: string;
  batchEnabled: boolean;
  profileConfigured: boolean;
  lastLoginAt: string | null;
}

export async function fetchBatchUsers(): Promise<BatchCandidate[]> {
  const res = await authFetch(`/admin/batch-users`);
  if (!res.ok) throw new Error("배치 대상 목록을 불러오지 못했습니다.");
  const data = (await res.json()) as { items: BatchCandidate[] };
  return data.items;
}

// 특정 유저의 자동 배치 등록 상태를 켜고 끈다.
export async function setBatchUserEnabled(userId: string, enabled: boolean): Promise<void> {
  const res = await authFetch(`/admin/batch-users/${userId}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error("배치 대상 변경에 실패했습니다.");
}

export async function fetchFavoriteJobs(): Promise<JobPosting[]> {
  const res = await authFetch(`/admin/favorites`);
  return res.json();
}
