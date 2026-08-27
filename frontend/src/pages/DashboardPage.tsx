import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  deleteJob,
  fetchAllJobs,
  fetchMatchCheckStatus,
  fetchRatingCheckStatus,
  fetchRecommendations,
  toggleFavorite,
  triggerCollect,
} from "../api/client";
import { FilterRail } from "../components/FilterRail";
import { JobCard } from "../components/JobCard";
import { RecommendationModal } from "../components/RecommendationModal";
import { useJobFilters } from "../hooks/useJobFilters";
import type { JobPosting } from "../types";
import { parseMatchOverall } from "../utils/matchReport";
import { ensureProfileOrRedirect } from "../utils/profileGuard";

// 추천 공고 팝업을 닫은 업데이트 세션을 기록해, 같은 세션에선 새로고침해도 다시 뜨지 않게 한다.
const REC_DISMISS_KEY = "recommendationDismissedSession";

const PAGE_SIZE = 12;

// 강조 조건: 즐겨찾기 공고이거나, 매칭률 종합 70% 이상.
function isHighlighted(job: JobPosting): boolean {
  if (job.isFavorite === true) return true;
  const overall = parseMatchOverall(job.documents?.matchReport);
  return overall !== null && overall >= 70;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  // 필터·페이지네이션을 클라이언트에서 처리하기 위해 전체 목록을 한 번 받아 둔다.
  const [allJobs, setAllJobs] = useState<JobPosting[]>([]);
  const [collecting, setCollecting] = useState(false);
  const [collectStatus, setCollectStatus] = useState<string | null>(null);

  // 추천 공고 팝업 상태
  const [recItems, setRecItems] = useState<JobPosting[]>([]);
  const [recSessionId, setRecSessionId] = useState<string | null>(null);
  const [recOpen, setRecOpen] = useState(false);
  // 당일 추천 공고 id 집합(카드 강조용). 팝업 노출 여부와 분리해 유지한다.
  const [recommendedIds, setRecommendedIds] = useState<Set<string>>(new Set());

  const { filters, filteredJobs, regions, setSearchTerm, setRegion, setMatchThreshold } =
    useJobFilters(allJobs);

  function setPage(n: number) {
    setSearchParams({ page: String(n) }, { replace: true });
  }

  // 필터가 바뀌면 1페이지로. 최초 마운트에서는 URL의 page 파라미터를 유지한다.
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) setPage(1);
    else mounted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.searchTerm, filters.region, filters.matchThreshold]);

  async function reloadJobs() {
    const data = await fetchAllJobs();
    setAllJobs(data.items);
  }

  // 추천 공고 팝업 트리거: 최신 수집 세션의 매칭률 70%+가 있고, 그 세션을 아직 닫지 않았으면 노출.
  async function maybeShowRecommendations() {
    try {
      const { sessionId, items } = await fetchRecommendations();
      setRecommendedIds(new Set(items.map((j) => j.id)));
      if (!sessionId || items.length === 0) return;
      if (localStorage.getItem(REC_DISMISS_KEY) === sessionId) return;
      setRecItems(items);
      setRecSessionId(sessionId);
      setRecOpen(true);
    } catch {
      /* 추천 팝업은 부가 기능이라 실패해도 조용히 무시 */
    }
  }

  function handleRecClose() {
    if (recSessionId) localStorage.setItem(REC_DISMISS_KEY, recSessionId);
    setRecOpen(false);
  }

  useEffect(() => {
    reloadJobs();
    maybeShowRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 백엔드가 시작한 후속 배치를 폴링한다. running이 될 때까지 잠시 기다린 뒤(최대 ~12초) 끝날 때까지 대기.
  async function waitForBatch(pollStatus: () => Promise<{ running: boolean }>) {
    let started = false;
    for (let i = 0; i < 300; i++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const { running } = await pollStatus();
      if (running) started = true;
      else if (started || i >= 3) break;
    }
  }

  // UPDATE 버튼: 공고를 수동 수집한다. 수집 완료 직후 백엔드(/collect)가 평점 조회 → 매칭률 조회
  // 배치를 순서대로 이어서 자동 실행하므로 여기서 따로 트리거하지 않는다. 여기서는 완료를 순서대로
  // 폴링해 화면만 갱신한다.
  async function handleCollect() {
    if (!(await ensureProfileOrRedirect(navigate))) return;
    setCollecting(true);
    setCollectStatus("수집 중...");
    try {
      const result = await triggerCollect();
      const base =
        `${result.collected}건 수집, ${result.newlyMatched}건 신규 매칭` +
        (result.skillFileWarning ? ` / ⚠ ${result.skillFileWarning}` : "");
      setCollectStatus(`${base} / 평점 조회 중...`);
      await reloadJobs();
      setPage(1);

      await waitForBatch(fetchRatingCheckStatus);
      await reloadJobs();
      setCollectStatus(`${base}, 평점 조회 완료 / 매칭률 조회 중...`);

      await waitForBatch(fetchMatchCheckStatus);
      await reloadJobs();
      setCollectStatus(`${base}, 평점 조회 완료, 매칭률 조회 완료`);

      await maybeShowRecommendations();
    } catch {
      setCollectStatus("수집 실패");
    } finally {
      setCollecting(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteJob(id);
    setAllJobs((list) => list.filter((j) => j.id !== id));
  }

  async function handleFavorite(id: string) {
    const result = await toggleFavorite(id);
    setAllJobs((list) =>
      list.map((j) => (j.id === id ? { ...j, isFavorite: result.isFavorite } : j)),
    );
  }

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredJobs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const isEmpty = pageItems.length === 0;
  const isFiltering =
    filters.searchTerm.trim() !== "" || filters.region !== "all" || filters.matchThreshold !== 0;

  return (
    <div className="dashboard">
      <FilterRail
        regions={regions}
        region={filters.region}
        matchThreshold={filters.matchThreshold}
        onRegionChange={setRegion}
        onMatchThresholdChange={setMatchThreshold}
      />

      <div className="dashboard-main">
        <div className="dashboard-searchrow">
          <input
            type="text"
            className="search-input"
            aria-label="공고 검색"
            placeholder="회사명·공고명·지역으로 검색"
            value={filters.searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className="btn-update" onClick={handleCollect} disabled={collecting}>
            {collecting ? "UPDATE 중..." : "공고 UPDATE"}
          </button>
        </div>
        {collectStatus && <p className="collect-status" role="status">{collectStatus}</p>}

        {isEmpty && !isFiltering ? (
          <p className="dashboard-empty">
            아직 수집된 공고가 없습니다. 매일 00:00~09:00 사이 자동으로 수집됩니다.
          </p>
        ) : isEmpty && isFiltering ? (
          <p className="dashboard-empty">조건에 맞는 공고가 없습니다.</p>
        ) : (
          <>
            <div className="job-grid">
              {pageItems.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  highlighted={isHighlighted(job)}
                  today={recommendedIds.has(job.id)}
                  onFavorite={handleFavorite}
                  onDelete={handleDelete}
                />
              ))}
            </div>

            <div className="pagination">
              {totalPages > 1 && (
                <div className="pagination-controls">
                  <button
                    className="page-link"
                    disabled={safePage <= 1}
                    onClick={() => setPage(safePage - 1)}
                  >
                    이전
                  </button>
                  <span className="page-indicator">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    className="page-link"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage(safePage + 1)}
                  >
                    다음
                  </button>
                </div>
              )}
              <div className="dashboard-footer">총 {filteredJobs.length}개</div>
            </div>
          </>
        )}
      </div>

      {recOpen && <RecommendationModal items={recItems} onClose={handleRecClose} />}
    </div>
  );
}
