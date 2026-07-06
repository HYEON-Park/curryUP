import { Router } from "express";
import { getJobPostings, hideJob, toggleFavorite } from "../data/store.js";
import type { JobPosting } from "../types.js";
import { daysUntilDeadline } from "../utils/deadline.js";

export const jobsRouter = Router();
const PAGE_SIZE = 12;

// D-day가 긴(남은 일수가 많은) 순서로 정렬하고, 같으면 기업명 가나다순으로 정렬한다.
// 마감일이 없는 공고는 맨 뒤로 보내고 그 안에서는 기업명 가나다순으로 정렬한다.
function compareJobs(a: JobPosting, b: JobPosting): number {
  const aDays = daysUntilDeadline(a.deadline);
  const bDays = daysUntilDeadline(b.deadline);

  if (aDays === null && bDays === null) return a.company.localeCompare(b.company, "ko");
  if (aDays === null) return 1;
  if (bDays === null) return -1;
  if (aDays !== bDays) return bDays - aDays;
  return a.company.localeCompare(b.company, "ko");
}

// 마감 임박(D-0~N) 공고 정리는 deleteImminentJobPostings()(서버 기동 시 + 매일 자정 scrapeTask)가
// 전담하므로, 여기서는 순수하게 저장된 목록을 읽어 응답하기만 한다.
jobsRouter.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const allJobs = await getJobPostings();

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
jobsRouter.get("/all", async (_req, res) => {
  const allJobs = await getJobPostings();
  const sorted = [...allJobs].sort(compareJobs);
  res.json({ items: sorted });
});

jobsRouter.get("/:id", async (req, res) => {
  const jobs = await getJobPostings();
  const job = jobs.find((j) => j.id === req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

jobsRouter.patch("/:id/favorite", async (req, res) => {
  const result = await toggleFavorite(req.params.id);
  if (result === null) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({ isFavorite: result });
});

jobsRouter.delete("/:id", async (req, res) => {
  const success = await hideJob(req.params.id);
  if (!success) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({ success: true });
});
