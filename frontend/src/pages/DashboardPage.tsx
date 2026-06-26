import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { deleteJob, fetchJobs, triggerCollect } from "../api/client";
import type { JobPosting } from "../types";
import { formatDday } from "../utils/dday";

function sourceLabel(sourceUrl: string): string {
  if (sourceUrl.includes("jobkorea.co.kr")) return "J";
  if (sourceUrl.includes("saramin.co.kr")) return "S";
  return "?";
}

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const [items, setItems] = useState<JobPosting[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [collecting, setCollecting] = useState(false);
  const [collectStatus, setCollectStatus] = useState<string | null>(null);

  function setPage(n: number) {
    setSearchParams({ page: String(n) }, { replace: true });
  }

  useEffect(() => {
    fetchJobs(page).then((data) => {
      setItems(data.items);
      setTotalPages(data.totalPages);
      setTotalItems(data.totalItems);
    });
  }, [page]);

  async function handleCollect() {
    setCollecting(true);
    setCollectStatus("수집 중...");
    try {
      const result = await triggerCollect();
      setCollectStatus(
        `${result.collected}건 수집, ${result.newlyMatched}건 신규 매칭 (문서 생성은 23:00 배치에서 처리됩니다)`
      );
      const data = await fetchJobs(1);
      setPage(1);
      setItems(data.items);
      setTotalPages(data.totalPages);
      setTotalItems(data.totalItems);
    } catch {
      setCollectStatus("수집 실패");
    } finally {
      setCollecting(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteJob(id);
    const data = await fetchJobs(page);
    setItems(data.items);
    setTotalPages(data.totalPages);
    setTotalItems(data.totalItems);
  }

  return (
    <div>
      <div className="dashboard-toolbar">
        {collectStatus && <span>{collectStatus}</span>}
        <button onClick={handleCollect} disabled={collecting}>
          {collecting ? "공고업데이트 중..." : "공고업데이트"}
        </button>
      </div>

      {items.length === 0 ? (
        <p>아직 수집된 공고가 없습니다. 매일 00:00~09:00 사이 자동으로 수집됩니다.</p>
      ) : (
        <>
          <div className="job-grid">
            {items.map((job) => (
              <Link key={job.id} to={`/jobs/${job.id}`} className="job-card">
                <span className="job-source">{sourceLabel(job.sourceUrl)}</span>
                <h3>{job.company}</h3>
                <p>
                  {job.location}
                  <br />
                  {job.title}
                </p>
                <span className="dday">{formatDday(job.deadline)}</span>
                <button
                  className="job-card-delete"
                  title="삭제"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(job.id);
                  }}
                >
                  ×
                </button>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <div className="pagination-nav">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  이전
                </button>
                <span>
                  {page} / {totalPages}
                </span>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  다음
                </button>
              </div>
              <span className="pagination-total">총 {totalItems}개</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
