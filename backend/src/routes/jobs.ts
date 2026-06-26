import { Router } from "express";
import { getJobPostings, hideJob, saveJobPostings } from "../data/store.js";
import type { JobPosting } from "../types.js";

export const jobsRouter = Router();
const PAGE_SIZE = 12;

// deadline 표기("~ 07/18(토)")에서 남은 일수를 뽑아낸다. "상시채용"/"채용시"처럼
// 날짜가 없는 표기나 null은 정렬에서 맨 뒤로 보내기 위해 null을 반환한다.
function daysUntilDeadline(deadline: string | null): number | null {
  if (!deadline) return null;
  const match = deadline.match(/(\d{1,2})\/(\d{1,2})/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let target = new Date(today.getFullYear(), month - 1, day);
  if (target < today) target = new Date(today.getFullYear() + 1, month - 1, day);

  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// 오늘(D-0) 또는 내일(D-1) 마감인 공고는 지원 시간이 부족하므로 대시보드에서 제외한다.
function isImminentDeadline(deadline: string | null): boolean {
  const days = daysUntilDeadline(deadline);
  return days !== null && days <= 1;
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
  const allJobs = await getJobPostings();

  const imminent = allJobs.filter((j) => isImminentDeadline(j.deadline));
  const visible = imminent.length > 0
    ? allJobs.filter((j) => !isImminentDeadline(j.deadline))
    : allJobs;

  if (imminent.length > 0) {
    await saveJobPostings(visible);
  }

  const sorted = [...visible].sort(compareJobs);
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

jobsRouter.delete("/:id", async (req, res) => {
  const success = await hideJob(req.params.id);
  if (!success) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({ success: true });
});
