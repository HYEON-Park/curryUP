import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchJobs } from "../api/client";
import type { JobPosting } from "../types";
import { formatDday } from "../utils/dday";

export function DashboardPage() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<JobPosting[]>([]);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchJobs(page).then((data) => {
      setItems(data.items);
      setTotalPages(data.totalPages);
    });
  }, [page]);

  if (items.length === 0) {
    return <p>아직 수집된 공고가 없습니다. 매일 00:00~09:00 사이 자동으로 수집됩니다.</p>;
  }

  return (
    <div>
      <div className="job-grid">
        {items.map((job) => (
          <Link key={job.id} to={`/jobs/${job.id}`} className="job-card">
            <h3>{job.company}</h3>
            <p>
              {job.location}
              <br />
              {job.title}
            </p>
            <span className="dday">{formatDday(job.deadline)}</span>
          </Link>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            이전
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            다음
          </button>
        </div>
      )}
    </div>
  );
}
