import { Router } from "express";
import { getJobPostings } from "../data/store.js";

export const jobsRouter = Router();
const PAGE_SIZE = 12;

jobsRouter.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const jobs = await getJobPostings();
  const sorted = [...jobs].sort(
    (a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime()
  );
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
