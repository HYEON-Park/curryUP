import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  deleteJob,
  fetchAllJobs,
  fetchJobs,
  fetchRatingCheckStatus,
  runRatingCheckBatch,
  toggleFavorite,
  triggerCollect,
} from "../api/client";
import type { JobPosting } from "../types";
import { formatDday } from "../utils/dday";

function sourceLabel(sourceUrl: string): string {
  if (sourceUrl.includes("jobkorea.co.kr")) return "J";
  if (sourceUrl.includes("saramin.co.kr")) return "S";
  return "?";
}

type SearchField = "company" | "title" | "location";
const PAGE_SIZE = 12; // 백엔드 PAGE_SIZE와 동일 — 검색 중 클라이언트 페이지네이션에 사용

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const [items, setItems] = useState<JobPosting[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [collecting, setCollecting] = useState(false);
  const [collectStatus, setCollectStatus] = useState<string | null>(null);
  const [searchField, setSearchField] = useState<SearchField>("company");
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState<{ field: SearchField; term: string } | null>(null);
  // 검색은 전체 페이지를 대상으로 해야 하므로, 검색 활성화 시 전체 공고를 한 번 받아와 클라이언트에서 필터링·페이지네이션한다.
  const [allJobs, setAllJobs] = useState<JobPosting[]>([]);

  function setPage(n: number) {
    setSearchParams({ page: String(n) }, { replace: true });
  }

  useEffect(() => {
    if (activeSearch) return;
    fetchJobs(page).then((data) => {
      setItems(data.items);
      setTotalPages(data.totalPages);
      setTotalItems(data.totalItems);
    });
  }, [page, activeSearch]);

  async function handleSearch() {
    const term = searchInput.trim().toLowerCase();
    if (!term) {
      setActiveSearch(null);
      setPage(1);
      return;
    }
    const data = await fetchAllJobs();
    setAllJobs(data.items);
    setActiveSearch({ field: searchField, term });
    setPage(1);
  }

  async function refreshCurrentView(targetPage: number) {
    if (activeSearch) {
      const data = await fetchAllJobs();
      setAllJobs(data.items);
    } else {
      const data = await fetchJobs(targetPage);
      setItems(data.items);
      setTotalPages(data.totalPages);
      setTotalItems(data.totalItems);
    }
  }

  // UPDATE 버튼: 공고 수집이 끝나면 이어서 평점 조회까지 한 번에 실행한다.
  // 두 배치는 관리자 배치 로그에는 각각 별도 항목(collect / 평점조회)으로 기록된다.
  async function handleCollect() {
    setCollecting(true);
    setCollectStatus("수집 중...");
    try {
      const result = await triggerCollect();
      setCollectStatus(
        `${result.collected}건 수집, ${result.newlyMatched}건 신규 매칭 (문서 생성은 23:00 배치에서 처리됩니다)` +
          (result.skillFileWarning ? ` / ⚠ ${result.skillFileWarning}` : "") +
          " / 평점 조회 중..."
      );
      await refreshCurrentView(1);
      setPage(1);

      await runRatingCheckBatch();
      let running = true;
      while (running) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        ({ running } = await fetchRatingCheckStatus());
      }
      await refreshCurrentView(1);
      setCollectStatus(
        `${result.collected}건 수집, ${result.newlyMatched}건 신규 매칭, 평점 조회 완료` +
          (result.skillFileWarning ? ` / ⚠ ${result.skillFileWarning}` : "")
      );
    } catch {
      setCollectStatus("수집 실패");
    } finally {
      setCollecting(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteJob(id);
    if (activeSearch) {
      const data = await fetchAllJobs();
      setAllJobs(data.items);
    } else {
      const data = await fetchJobs(page);
      setItems(data.items);
      setTotalPages(data.totalPages);
      setTotalItems(data.totalItems);
    }
  }

  async function handleFavorite(id: string) {
    const result = await toggleFavorite(id);
    const applyFavorite = (list: JobPosting[]) =>
      list.map((j) => (j.id === id ? { ...j, isFavorite: result.isFavorite } : j));
    setItems(applyFavorite);
    setAllJobs(applyFavorite);
  }

  const filteredAll = activeSearch
    ? allJobs.filter((job) => job[activeSearch.field].trim().toLowerCase().includes(activeSearch.term))
    : [];
  const searchTotalPages = Math.max(1, Math.ceil(filteredAll.length / PAGE_SIZE));
  const searchPageItems = filteredAll.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const displayedItems = activeSearch ? searchPageItems : items;
  const displayedTotalPages = activeSearch ? searchTotalPages : totalPages;
  const displayedTotalItems = activeSearch ? filteredAll.length : totalItems;

  const isEmpty = displayedItems.length === 0;
  const isSearchActive = activeSearch !== null;

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
          <select
            className="search-field-select"
            value={searchField}
            onChange={(e) => setSearchField(e.target.value as SearchField)}
          >
            <option value="company">회사명</option>
            <option value="title">제목</option>
            <option value="location">지역</option>
          </select>
          <input
            type="text"
            className="search-input"
            placeholder="검색어를 입력하세요."
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
            {displayedItems.map((job) => (
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
                <h3>
                  {job.company} <span className="job-rating">({job.rating ?? "—"})</span>
                </h3>
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

          {displayedTotalPages > 1 && (
            <div className="pagination">
              <div className="pagination-nav">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  이전
                </button>
                <span>
                  {page} / {displayedTotalPages}
                </span>
                <button disabled={page >= displayedTotalPages} onClick={() => setPage(page + 1)}>
                  다음
                </button>
              </div>
              <span className="pagination-total">총 {displayedTotalItems}개</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
