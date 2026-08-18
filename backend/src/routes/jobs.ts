import { Router } from "express";
import { authMiddleware } from "../auth/jwt.js";
import { getJobPostings, hideJob, toggleFavorite } from "../data/store.js";
import {
  getSingleDocState,
  isDocType,
  startSingleDocGeneration,
} from "../scheduler/singleDocJob.js";
import { compareJobs, getRecommendations } from "../utils/recommendations.js";

export const jobsRouter = Router();
jobsRouter.use(authMiddleware);
const PAGE_SIZE = 12;

// 정렬(compareJobs)·추천 판정(getRecommendations) 규칙은 utils/recommendations.ts 한 곳에서
// 공유한다(추천 팝업·UPDATE 완료 메일과 동일 규칙).

// 마감 임박(D-0~N) 공고 정리는 deleteImminentJobPostings()(서버 기동 시 + 매일 08:00 scrapeTask)가
// 전담하므로, 여기서는 순수하게 저장된 목록을 읽어 응답하기만 한다.
jobsRouter.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const allJobs = await getJobPostings(req.user!.userId);

  const sorted = [...allJobs].sort(compareJobs);
  const start = (page - 1) * PAGE_SIZE;
  res.json({
    items: sorted.slice(start, start + PAGE_SIZE),
    page,
    totalPages: Math.max(1, Math.ceil(sorted.length / PAGE_SIZE)),
    totalItems: sorted.length,
  });
});

// 대시보드 다중 조건 검색(회사명/제목/지역)은 전체 페이지를 대상으로 해야 하므로,
// 클라이언트가 검색을 활성화할 때 페이지네이션 없이 전체 목록을 한 번에 내려준다.
jobsRouter.get("/all", async (req, res) => {
  const allJobs = await getJobPostings(req.user!.userId);
  const sorted = [...allJobs].sort(compareJobs);
  res.json({ items: sorted });
});

// 추천 공고 팝업(수동 업데이트 파이프라인 4단계)용. 가장 최근 수집 세션이 모은 공고 중
// 매칭률 종합 70% 이상만 반환한다.
// sessionId: 이번 수집 세션 식별자(= 수집 파이프라인의 가장 최근 실행 id). 프런트가 이 값을
// dismiss 플래그(localStorage)로 써서 "이미 본 세션"은 다시 띄우지 않는다. 수집 이력이 없으면 null.
// 주의: 이 라우트는 "/:id"보다 먼저 등록해야 "recommendations"가 id로 매칭되지 않는다.
//
// 날짜 경계와 무관하게 "최신 세션" 기준으로 판정한다.
// (예전엔 date===today로 제한해, 20시 스케줄 scrape로 수집하고 다음 날 아침 대시보드를 열면
//  날짜가 넘어가 sessionId=null·items=0 → 팝업이 아예 안 떴다. 이제 그 세션을 한 번 볼 때까지 뜬다.)
jobsRouter.get("/recommendations", async (req, res) => {
  const userId = req.user!.userId;

  // 추천 판정(세션 식별·70% 문턱·미종료·정렬)은 utils/recommendations.getRecommendations 한 곳에서
  // 수행한다(UPDATE 완료 메일과 동일 규칙 공유).
  const { sessionId, items } = await getRecommendations(userId);

  res.json({ sessionId, items });
});

jobsRouter.get("/:id", async (req, res) => {
  const jobs = await getJobPostings(req.user!.userId);
  const job = jobs.find((j) => j.id === req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

jobsRouter.patch("/:id/favorite", async (req, res) => {
  const result = await toggleFavorite(req.user!.userId, req.params.id);
  if (result === null) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({ isFavorite: result });
});

jobsRouter.delete("/:id", async (req, res) => {
  const success = await hideJob(req.user!.userId, req.params.id);
  if (!success) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({ success: true });
});

// 공고 상세 페이지: 해당 탭 문서를 사용자가 직접 즉시 생성한다(Claude CLI headless).
// 저장 위치는 기존 documents.{docType}를 그대로 재사용한다.
jobsRouter.post("/:id/documents/:docType/generate", async (req, res) => {
  const { id, docType } = req.params;
  if (!isDocType(docType)) {
    res.status(400).json({ error: "INVALID_DOC_TYPE" });
    return;
  }
  const result = await startSingleDocGeneration(req.user!.userId, id, docType);
  switch (result) {
    case "no-profile":
      res.status(400).json({ error: "NO_PROFILE" });
      return;
    case "not-found":
      res.status(404).json({ error: "Job not found" });
      return;
    case "busy":
      res.status(409).json({ error: "BUSY" });
      return;
    default:
      res.status(202).json({ started: true });
  }
});

// 생성 상태 폴링용. running=false + hasContent=true면 완료, running=false + hasContent=false면 실패.
jobsRouter.get("/:id/documents/:docType/status", async (req, res) => {
  const { id, docType } = req.params;
  if (!isDocType(docType)) {
    res.status(400).json({ error: "INVALID_DOC_TYPE" });
    return;
  }
  const jobs = await getJobPostings(req.user!.userId);
  const job = jobs.find((j) => j.id === id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(getSingleDocState(req.user!.userId, id, docType, job.documents?.[docType]));
});
