import { Router } from "express";
import { getImminentThresholdDays } from "../config/skillFileParser.js";
import { getJobPostings, hideJob, saveJobPostings, toggleFavorite } from "../data/store.js";
import type { JobPosting } from "../types.js";
import { daysUntilDeadline } from "../utils/deadline.js";

export const jobsRouter = Router();
const PAGE_SIZE = 12;

// SKILL.md의 "마감 임박 공고 자동 삭제" 기준(D-N) 이내인 공고는 대시보드에서 제외한다.
function isImminentDeadline(deadline: string | null, thresholdDays: number): boolean {
  const days = daysUntilDeadline(deadline);
  return days !== null && days <= thresholdDays;
}

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

jobsRouter.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  const allJobs = await getJobPostings();
  const thresholdDays = await getImminentThresholdDays();

  const imminent = allJobs.filter((j) => isImminentDeadline(j.deadline, thresholdDays));
  const visible = imminent.length > 0
    ? allJobs.filter((j) => !isImminentDeadline(j.deadline, thresholdDays))
    : allJobs;

  if (imminent.length > 0) {
    await saveJobPostings(visible);
  }

  const filtered = q ? visible.filter((j) => j.company.toLowerCase().includes(q)) : visible;
  const sorted = [...filtered].sort(compareJobs);
  const start = (page - 1) * PAGE_SIZE;
  res.json({
    items: sorted.slice(start, start + PAGE_SIZE),
    page,
    totalPages: Math.max(1, Math.ceil(sorted.length / PAGE_SIZE)),
    totalItems: sorted.length,
  });
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
