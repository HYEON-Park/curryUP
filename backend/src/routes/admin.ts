import { Router } from "express";
import { authMiddleware, requireAdmin } from "../auth/jwt.js";
import { getHiddenJobs, getJobPostings, hasProfile, listBatchCandidates, permanentDeleteAllHiddenJobs, permanentDeleteHiddenJobs, restoreJob, setBatchEnabled } from "../data/store.js";
import { runClosedCheckNow } from "../scheduler/closedCheckJob.js";
import { MATCH_CHECK_JOB_NAME, runMatchCheckIfNeeded } from "../scheduler/matchCheckJob.js";
import { runNotifyNow } from "../scheduler/notifyJob.js";
import { RATING_CHECK_JOB_NAME, runRatingCheckNow } from "../scheduler/ratingCheckJob.js";
import { getRunHistory, isJobRunning } from "../scheduler/runLog.js";
import { runScrapeNow } from "../scheduler/scrapeJob.js";
import { runWriteDocumentsIfNeeded, WRITE_DOCS_JOB_NAME } from "../scheduler/writeDocumentsJob.js";

export const adminRouter = Router();
// 관리자 페이지의 두 탭만 ADMIN 전용이다: "배치 모니터링 및 제어"(배치 실행·실행이력)·"배치 대상 등록".
// 나머지 탭("대쉬보드 관리"=숨김공고, "즐겨찾기 관리")은 본인 데이터라 USER도 접근 가능하게 둔다.
// → 인증은 라우터 레벨(authMiddleware), 권한(requireAdmin)은 ADMIN 전용 라우트에만 개별 적용한다.
adminRouter.use(authMiddleware);

// ── "배치 모니터링 및 제어" 탭 (ADMIN 전용) ──────────────────────
adminRouter.get("/runs", requireAdmin, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  res.json(await getRunHistory(req.user!.userId, page));
});

adminRouter.post("/scrape/run", requireAdmin, async (req, res) => {
  const userId = req.user!.userId;
  // 프로필이 없으면 초기화(삭제)까지 막아야 하므로 재수집 진입 전에 차단한다(프런트도 동일 가드).
  if (!(await hasProfile(userId))) {
    res.status(400).json({ error: "NO_PROFILE" });
    return;
  }
  const scope = req.query.scope === "all" ? "all" : "today";
  res.json(await runScrapeNow(userId, scope));
});

adminRouter.post("/notify/run", requireAdmin, async (req, res) => {
  res.json(await runNotifyNow(req.user!.userId));
});

adminRouter.get("/ai/status", requireAdmin, async (req, res) => {
  const running = await isJobRunning(req.user!.userId, WRITE_DOCS_JOB_NAME);
  res.json({ running });
});

// Claude Code 문서 작성 배치는 수 분 걸릴 수 있어 응답을 기다리지 않고 즉시 시작만 알린다.
// 작성 대상이 없으면 runWriteDocumentsIfNeeded가 실행 이력 없이 건너뛴다. 진행 상황은 GET /runs 폴링으로 확인한다.
adminRouter.post("/ai/run", requireAdmin, (req, res) => {
  const userId = req.user!.userId;
  runWriteDocumentsIfNeeded(userId).catch((error) => console.error("[admin] write-documents batch failed:", error));
  res.status(202).json({ started: true });
});

adminRouter.get("/rating-check/status", requireAdmin, async (req, res) => {
  const running = await isJobRunning(req.user!.userId, RATING_CHECK_JOB_NAME);
  res.json({ running });
});

// 회사 수만큼 순차 크롤링이라 몇 분 걸릴 수 있어 응답을 기다리지 않고 즉시 시작만 알린다.
adminRouter.post("/rating-check/run", requireAdmin, (req, res) => {
  const userId = req.user!.userId;
  runRatingCheckNow(userId).catch((error) => console.error("[admin] rating check batch failed:", error));
  res.status(202).json({ started: true });
});

adminRouter.get("/match-check/status", requireAdmin, async (req, res) => {
  const running = await isJobRunning(req.user!.userId, MATCH_CHECK_JOB_NAME);
  res.json({ running });
});

// 당일 수집분의 매칭률 평가표를 Claude가 작성하는 배치. 수 분 걸릴 수 있어 시작만 알린다.
// 대상이 없으면 실행 이력 없이 건너뛴다(started:false). 진행 상황은 GET /runs 폴링으로 확인한다.
adminRouter.post("/match-check/run", requireAdmin, (req, res) => {
  const userId = req.user!.userId;
  runMatchCheckIfNeeded(userId).catch((error) => console.error("[admin] match check batch failed:", error));
  res.status(202).json({ started: true });
});

// 수집 공고의 진행중/종료 여부를 점검하는 배치. 공고 수만큼 순차 요청이라 수십 초 걸릴 수 있어
// 응답을 기다리지 않고 시작만 알린다(진행 상황은 GET /runs 폴링).
adminRouter.post("/closed-check/run", requireAdmin, (req, res) => {
  const userId = req.user!.userId;
  runClosedCheckNow(userId).catch((error) => console.error("[admin] closed check batch failed:", error));
  res.status(202).json({ started: true });
});

// ── "배치 대상 등록" 탭 (ADMIN 전용) ─────────────────────────────
// 가입 유저 전체를 이메일·등록 여부·프로필 충족 여부와 함께 반환한다(전체 회원 개인정보 → requireAdmin).
// 관리자가 등록(batchEnabled)한 유저만 자동 배치(스케줄)가 사용자별 순차로 돈다.
adminRouter.get("/batch-users", requireAdmin, async (_req, res) => {
  res.json({ items: await listBatchCandidates() });
});

// 특정 유저의 자동 배치 등록 상태를 켜고 끈다(대상 userId를 URL로 받으므로 ADMIN 전용).
adminRouter.patch("/batch-users/:userId", requireAdmin, async (req, res) => {
  const { enabled } = req.body as { enabled?: unknown };
  if (typeof enabled !== "boolean") {
    res.status(400).json({ error: "enabled(boolean) required" });
    return;
  }
  await setBatchEnabled(req.params.userId, enabled);
  res.json({ userId: req.params.userId, batchEnabled: enabled });
});

adminRouter.get("/favorites", async (req, res) => {
  const all = await getJobPostings(req.user!.userId);
  res.json(all.filter((j) => j.isFavorite === true));
});

const HIDDEN_PAGE_SIZE = 20;

adminRouter.get("/hidden-jobs", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const all = await getHiddenJobs(req.user!.userId);
  const start = (page - 1) * HIDDEN_PAGE_SIZE;
  res.json({
    items: all.slice(start, start + HIDDEN_PAGE_SIZE),
    page,
    totalPages: Math.max(1, Math.ceil(all.length / HIDDEN_PAGE_SIZE)),
    totalItems: all.length,
  });
});

adminRouter.post("/hidden-jobs/purge-selected", async (req, res) => {
  const { ids } = req.body as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids array required" });
    return;
  }
  await permanentDeleteHiddenJobs(req.user!.userId, ids);
  res.json({ success: true });
});

adminRouter.post("/hidden-jobs/purge-all", async (req, res) => {
  await permanentDeleteAllHiddenJobs(req.user!.userId);
  res.json({ success: true });
});

adminRouter.post("/hidden-jobs/:id/restore", async (req, res) => {
  const success = await restoreJob(req.user!.userId, req.params.id);
  if (!success) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({ success: true });
});
