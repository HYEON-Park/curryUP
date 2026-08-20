import { promises as fs, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getImminentThresholdDays } from "../config/skillFileParser.js";
import type { HiddenJobPosting, JobPosting, PurgedJobHistoryEntry, UserProfile } from "../types.js";
import { isCollectedToday } from "../utils/date.js";
import { daysUntilDeadline } from "../utils/deadline.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 데이터는 backend/src/data/ 아래에 둔다(기존 경로 유지). 유저별 데이터는 카테고리 폴더 안에
// {userId}.json 개별 파일로 분리해, A/B 유저 동시 수정 시 파일 충돌을 원천 차단한다.
const DATA_DIR = __dirname;
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PROFILES_DIR = path.join(DATA_DIR, "profiles");
const JOBS_DIR = path.join(DATA_DIR, "jobPostings");
const HIDDEN_DIR = path.join(DATA_DIR, "hiddenJobPostings");
const PURGED_DIR = path.join(DATA_DIR, "purgedJobHistory");

// 서버 기동 시 유저별 폴더가 없으면 자동 생성한다.
for (const dir of [PROFILES_DIR, JOBS_DIR, HIDDEN_DIR, PURGED_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function userFile(dir: string, userId: string): string {
  return path.join(dir, `${userId}.json`);
}

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

// ==================== 회원 계정 (users.json) ====================

export interface User {
  userId: string;
  email: string;
  password: string; // bcrypt hash
  createdAt: string;
  lastLoginAt: string | null;
  // 마지막 로그인이 로컬(localhost/LAN)에서 왔는지. 공개 URL(터널)로 로그인하면 false.
  // (레거시: 예전엔 이 값으로 자동 배치 대상을 골랐으나, 이제는 관리자가 등록한 batchEnabled로 대체됨.)
  lastLoginLocal?: boolean;
  // 관리자 페이지에서 이 유저를 자동 배치(수집·매칭률·문서작성·알림·종료점검) 대상으로 등록했는지.
  // true인 유저만 스케줄 배치가 돈다(getBatchUserIds). 필드가 없으면 미등록(대상 아님)으로 본다.
  batchEnabled?: boolean;
  // 권한. 전역 대상 관리자 라우트(배치 대상 등록 등)는 ADMIN만 접근 가능하다.
  // 필드가 없으면 일반 유저(USER)로 본다. 부트스트랩용으로 .env ADMIN_EMAILS 화이트리스트도 함께 인정한다.
  role?: UserRole;
  emailVerified: boolean;
  verifyToken: string | null;
  verifyExpires: string | null; // ISO
  // 비밀번호 재설정 토큰(이메일 인증 토큰과 별도). 발급 시 채우고, 재설정 완료·미요청이면 null.
  resetToken?: string | null;
  resetExpires?: string | null; // ISO
}

export type UserRole = "USER" | "ADMIN";

// .env ADMIN_EMAILS(쉼표구분)에 든 이메일은 users.json의 role과 무관하게 관리자로 인정한다.
// 최초 관리자를 users.json 직접 수정 없이 지정하기 위한 부트스트랩 경로다.
function adminEmailWhitelist(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

// 유저의 실효 권한을 계산한다(저장된 role 또는 ADMIN_EMAILS 화이트리스트면 ADMIN).
export function resolveUserRole(user: Pick<User, "email" | "role">): UserRole {
  if (user.role === "ADMIN") return "ADMIN";
  if (adminEmailWhitelist().has(user.email)) return "ADMIN";
  return "USER";
}

// 해당 유저가 관리자인지 판정한다. 토큰이 아니라 저장소를 매번 확인하므로,
// 권한을 회수하면 기존 토큰에도 즉시 반영된다(requireAdmin 미들웨어가 사용).
export async function isUserAdmin(userId: string): Promise<boolean> {
  const user = await findUserById(userId);
  if (!user) return false;
  return resolveUserRole(user) === "ADMIN";
}

// 로그인 시 화이트리스트 이메일이면 users.json의 role을 ADMIN으로 승격해 영속화한다(PRD 3.4).
// 이미 ADMIN이거나 화이트리스트가 아니면 아무 것도 하지 않는다.
export async function syncAdminRoleFromWhitelist(userId: string): Promise<void> {
  const user = await findUserById(userId);
  if (!user) return;
  if (user.role !== "ADMIN" && adminEmailWhitelist().has(user.email)) {
    await updateUser(userId, { role: "ADMIN" });
  }
}

async function readUsers(): Promise<User[]> {
  return readJson(USERS_FILE, [] as User[]);
}

export async function getUsers(): Promise<User[]> {
  return readUsers();
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const normalized = email.trim().toLowerCase();
  return (await readUsers()).find((u) => u.email === normalized);
}

export async function findUserById(userId: string): Promise<User | undefined> {
  return (await readUsers()).find((u) => u.userId === userId);
}

export async function saveUser(user: User): Promise<void> {
  const users = await readUsers();
  users.push(user);
  await writeJson(USERS_FILE, users);
}

// 로그인 시각 기록 — 배치 대상(가장 최근 로그인 유저) 선택에 쓰인다.
export async function setLastLogin(userId: string, local: boolean): Promise<void> {
  await updateUser(userId, { lastLoginAt: new Date().toISOString(), lastLoginLocal: local });
}

// 유저 레코드 부분 갱신(이메일 인증 상태·토큰·로그인 시각 등).
export async function updateUser(userId: string, patch: Partial<User>): Promise<void> {
  const users = await readUsers();
  const user = users.find((u) => u.userId === userId);
  if (!user) return;
  Object.assign(user, patch);
  await writeJson(USERS_FILE, users);
}

// 이메일 인증 토큰으로 유저를 찾는다(인증 링크 처리용).
export async function findUserByVerifyToken(token: string): Promise<User | undefined> {
  return (await readUsers()).find((u) => u.verifyToken === token);
}

// 비밀번호 재설정 토큰으로 유저를 찾는다(재설정 링크 처리용).
export async function findUserByResetToken(token: string): Promise<User | undefined> {
  return (await readUsers()).find((u) => u.resetToken === token);
}

// 재설정 토큰 발급/저장.
export async function setResetToken(userId: string, token: string, expires: string): Promise<void> {
  await updateUser(userId, { resetToken: token, resetExpires: expires });
}

// 비밀번호를 새 해시로 교체하고 재설정 토큰을 소거한다(재사용 방지).
export async function updatePassword(userId: string, passwordHash: string): Promise<void> {
  await updateUser(userId, { password: passwordHash, resetToken: null, resetExpires: null });
}

// 자동 배치(스크래핑/매칭률/문서작성/알림/종료점검) 대상 유저 목록.
// 관리자가 명시적으로 등록(batchEnabled=true)하고 프로필 필수값을 충족한 유저 전부를 반환한다.
// 스케줄러는 이 목록을 "사용자별 순차"로 돌린다(로컬 headless Claude CLI가 한 번에 하나만 구동되도록).
// 반환 순서는 users.json 저장 순서(대체로 가입순)를 따른다. 대상이 없으면 빈 배열(배치 건너뜀).
export async function getBatchUserIds(): Promise<string[]> {
  const users = await readUsers();
  const ids: string[] = [];
  for (const user of users) {
    if (user.batchEnabled !== true) continue;
    if (!isProfileConfigured(await getProfile(user.userId))) continue;
    ids.push(user.userId);
  }
  return ids;
}

// 관리자 페이지 "배치 대상 등록" 탭에 보여줄 후보 목록.
// 가입 유저 전체를 이메일·등록 여부·프로필 충족 여부와 함께 반환한다(프로필 미충족은 등록해도 배치에서 빠짐).
export interface BatchCandidate {
  userId: string;
  email: string;
  batchEnabled: boolean;
  profileConfigured: boolean;
  lastLoginAt: string | null;
}

export async function listBatchCandidates(): Promise<BatchCandidate[]> {
  const users = await readUsers();
  const result: BatchCandidate[] = [];
  for (const user of users) {
    result.push({
      userId: user.userId,
      email: user.email,
      batchEnabled: user.batchEnabled === true,
      profileConfigured: isProfileConfigured(await getProfile(user.userId)),
      lastLoginAt: user.lastLoginAt,
    });
  }
  return result;
}

// 관리자가 특정 유저의 자동 배치 등록 상태를 켜고 끈다.
export async function setBatchEnabled(userId: string, enabled: boolean): Promise<void> {
  await updateUser(userId, { batchEnabled: enabled });
}

// ==================== 프로필 (profiles/{userId}.json) ====================

export async function getProfile(userId: string): Promise<UserProfile> {
  return readJson(userFile(PROFILES_DIR, userId), DEFAULT_PROFILE);
}

export async function saveProfile(userId: string, profile: UserProfile): Promise<UserProfile> {
  const updated: UserProfile = { ...profile, lastProfileUpdate: new Date().toISOString() };
  await writeJson(userFile(PROFILES_DIR, userId), updated);
  return updated;
}

// 프로필 파일 존재 여부(온보딩 라우트 가드가 참고). 필수값 충족 여부는 isProfileConfigured로 본다.
export function profileFileExists(userId: string): boolean {
  return existsSync(userFile(PROFILES_DIR, userId));
}

// 프로필 작성 여부 판정 — 프런트 배치 가드·프로필 저장 검증이 공유하는 단일 규칙.
// 매칭 기준이 되는 필수값(희망 직무 카테고리 ≥1, 경력 년차)이 실제로 채워졌는지로 판정한다.
export function isProfileConfigured(profile: UserProfile): boolean {
  return (
    profile.yearsOfExperience !== null &&
    Array.isArray(profile.desiredRoleCategories) &&
    profile.desiredRoleCategories.length > 0
  );
}

// 프로필이 없으면 매칭 기준이 없어 스크래핑·매칭률·문서 작성 배치를 돌릴 수 없다.
export async function hasProfile(userId: string): Promise<boolean> {
  return isProfileConfigured(await getProfile(userId));
}

// ==================== 공고 (jobPostings/{userId}.json) ====================

export async function getJobPostings(userId: string): Promise<JobPosting[]> {
  return readJson(userFile(JOBS_DIR, userId), [] as JobPosting[]);
}

export async function saveJobPostings(userId: string, jobs: JobPosting[]): Promise<void> {
  await writeJson(userFile(JOBS_DIR, userId), jobs);
}

// ==================== 영구 삭제 이력 (purgedJobHistory/{userId}.json) ====================

export async function getPurgedJobHistory(userId: string): Promise<PurgedJobHistoryEntry[]> {
  return readJson(userFile(PURGED_DIR, userId), [] as PurgedJobHistoryEntry[]);
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
async function appendPurgedJobHistory(userId: string, jobs: Pick<JobPosting, "company" | "title">[]): Promise<void> {
  if (jobs.length === 0) return;
  const history = await getPurgedJobHistory(userId);
  const known = new Set(history.map(purgedJobKey));
  const purgedAt = new Date().toISOString();
  for (const job of jobs) {
    if (known.has(purgedJobKey(job))) continue;
    known.add(purgedJobKey(job));
    history.push({ company: job.company, title: job.title, purgedAt });
  }
  await writeJson(userFile(PURGED_DIR, userId), history);
}

// ==================== 숨김 공고 (hiddenJobPostings/{userId}.json) ====================

export async function getHiddenJobs(userId: string): Promise<HiddenJobPosting[]> {
  return readJson(userFile(HIDDEN_DIR, userId), [] as HiddenJobPosting[]);
}

async function saveHiddenJobs(userId: string, hidden: HiddenJobPosting[]): Promise<void> {
  await writeJson(userFile(HIDDEN_DIR, userId), hidden);
}

export async function permanentDeleteHiddenJobs(userId: string, ids: string[]): Promise<void> {
  const hidden = await getHiddenJobs(userId);
  await appendPurgedJobHistory(userId, hidden.filter((j) => ids.includes(j.id)));
  await saveHiddenJobs(userId, hidden.filter((j) => !ids.includes(j.id)));
}

export async function permanentDeleteAllHiddenJobs(userId: string): Promise<void> {
  const hidden = await getHiddenJobs(userId);
  await appendPurgedJobHistory(userId, hidden);
  await saveHiddenJobs(userId, []);
}

// 공고 삭제 시 연관된 생성 문서(자기소개서/경력기술서 등)도 함께 삭제한다.
export async function hideJob(userId: string, id: string): Promise<boolean> {
  const jobs = await getJobPostings(userId);
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx === -1) return false;
  const [job] = jobs.splice(idx, 1);
  await saveJobPostings(userId, jobs);
  const hidden = await getHiddenJobs(userId);
  hidden.unshift({ ...job, documents: null, hiddenAt: new Date().toISOString() });
  await saveHiddenJobs(userId, hidden);
  return true;
}

export async function restoreJob(userId: string, id: string): Promise<boolean> {
  const hidden = await getHiddenJobs(userId);
  const idx = hidden.findIndex((j) => j.id === id);
  if (idx === -1) return false;
  const hiddenJob = hidden[idx];
  hidden.splice(idx, 1);
  await saveHiddenJobs(userId, hidden);
  const { hiddenAt: _, ...job } = hiddenJob;
  const jobs = await getJobPostings(userId);
  jobs.push(job);
  await saveJobPostings(userId, jobs);
  return true;
}

// 관리자 페이지: 오늘 수집된 공고만 지워서 재수집 시 깨끗하게 다시 쌓이게 한다.
export async function deleteTodaysJobPostings(userId: string): Promise<void> {
  const jobs = await getJobPostings(userId);
  const remaining = jobs.filter((job) => !isCollectedToday(job.collectedAt));
  await saveJobPostings(userId, remaining);
}

// 서버 기동 시: SKILL.md의 "마감 임박 공고 자동 삭제" 기준(D-N) 이내인 공고를 즉시 제거한다.
export async function deleteImminentJobPostings(userId: string): Promise<void> {
  const jobs = await getJobPostings(userId);
  const thresholdDays = await getImminentThresholdDays();
  const remaining = jobs.filter((j) => {
    const days = daysUntilDeadline(j.deadline);
    return days === null || days > thresholdDays;
  });
  if (remaining.length < jobs.length) {
    console.log(`[store] 마감임박 공고 ${jobs.length - remaining.length}건 제거`);
    await saveJobPostings(userId, remaining);
  }
}

// 마감일 판정은 daysUntilDeadline 한 곳으로 통일한다(연도 포함 표기를 그대로 신뢰).
// "상시채용"/null처럼 날짜가 없는 공고는 daysUntilDeadline이 null을 주므로 만료 대상에서 제외된다.
function isPastDeadline(job: JobPosting): boolean {
  const days = daysUntilDeadline(job.deadline);
  return days !== null && days < 0;
}

export async function toggleFavorite(userId: string, id: string): Promise<boolean | null> {
  const jobs = await getJobPostings(userId);
  const job = jobs.find((j) => j.id === id);
  if (!job) return null;
  job.isFavorite = !job.isFavorite;
  await saveJobPostings(userId, jobs);
  return !!job.isFavorite;
}

// 데일리 배치: D-day(마감일)가 지난 공고는 더 이상 지원 대상이 아니므로 정리한다.
export async function deleteExpiredJobPostings(userId: string): Promise<void> {
  const jobs = await getJobPostings(userId);
  const remaining = jobs.filter((job) => !isPastDeadline(job));
  await saveJobPostings(userId, remaining);
}
