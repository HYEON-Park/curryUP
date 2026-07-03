import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { deleteJob, fetchJobs, toggleFavorite, triggerCollect } from "../api/client";
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
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  function setPage(n: number) {
    setSearchParams({ page: String(n) }, { replace: true });
  }

  useEffect(() => {
    fetchJobs(page, searchQuery || undefined).then((data) => {
      setItems(data.items);
      setTotalPages(data.totalPages);
      setTotalItems(data.totalItems);
    });
  }, [page, searchQuery]);

  function handleSearch() {
    const q = searchInput.trim();
    setSearchQuery(q);
    setPage(1);
  }

  async function handleCollect() {
    setCollecting(true);
    setCollectStatus("수집 중...");
    try {
      const result = await triggerCollect();
      setCollectStatus(
        `${result.collected}건 수집, ${result.newlyMatched}건 신규 매칭 (문서 생성은 23:00 배치에서 처리됩니다)` +
          (result.skillFileWarning ? ` / ⚠ ${result.skillFileWarning}` : "")
      );
      const data = await fetchJobs(1, searchQuery || undefined);
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
    const data = await fetchJobs(page, searchQuery || undefined);
    setItems(data.items);
    setTotalPages(data.totalPages);
    setTotalItems(data.totalItems);
  }

  async function handleFavorite(id: string) {
    const result = await toggleFavorite(id);
    setItems((prev) =>
      prev.map((j) => (j.id === id ? { ...j, isFavorite: result.isFavorite } : j))
    );
  }

  const isEmpty = items.length === 0;
  const isSearchActive = searchQuery.length > 0;

  return (
    <div>
      <div className="dashboard-toolbar">
        <div className="dashboard-toolbar-top">
          {collectStatus && <span>{collectStatus}</span>}
          <button onClick={handleCollect} disabled={collecting}>
            {collecting ? "UPDATE 중..." : "UPDATE"}
          </button>
        </div>
        <div className="dashboard-search">
          <input
            type="text"
            className="search-input"
            placeholder="회사명을 입력하세요."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button className="search-btn" onClick={handleSearch}>
            검색
          </button>
        </div>
      </div>

      {isEmpty && !isSearchActive ? (
        <p>아직 수집된 공고가 없습니다. 매일 00:00~09:00 사이 자동으로 수집됩니다.</p>
      ) : isEmpty && isSearchActive ? (
        <p className="search-empty">검색 결과와 일치하는 공고가 없습니다.</p>
      ) : (
        <>
          <div className="job-grid">
            {items.map((job) => (
              <Link key={job.id} to={`/jobs/${job.id}`} className="job-card">
                <span className="job-source">{sourceLabel(job.sourceUrl)}</span>
                <button
                  className={`job-card-favorite${job.isFavorite ? " favorited" : ""}`}
                  title={job.isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleFavorite(job.id);
                  }}
                >
                  {job.isFavorite ? "★" : "☆"}
                </button>
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
