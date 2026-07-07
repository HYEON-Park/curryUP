import { Fragment, useEffect, useRef, useState } from "react";
import {
  fetchFavoriteJobs,
  fetchHiddenJobs,
  fetchRuns,
  purgeAllHiddenJobs,
  purgeSelectedHiddenJobs,
  restoreHiddenJob,
  runAiBatch,
  runNotifyBatch,
  runScrapeBatch,
  toggleFavorite,
} from "../api/client";
import type { HiddenJobPosting, JobPosting, RunRecord } from "../types";

const JOB_LABELS: Record<string, string> = {
  scrape: "공고 스크래핑 배치",
  collect: "대시보드 수동 수집",
  notify: "오전 프로필 알림 배치",
  aiBatch: "야간 AI 문서 생성 배치",
  평점조회: "평점 조회 배치",
};

const STATUS_LABELS: Record<RunRecord["status"], string> = {
  success: "성공",
  failed: "실패",
  running: "진행중",
};

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function formatTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toTimeString().slice(0, 8);
}

// ─── 대쉬보드 관리 탭 ───────────────────────────────────────────────────────

function DashboardManagementTab() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<HiddenJobPosting[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const checkAllRef = useRef<HTMLInputElement>(null);

  async function load(p: number) {
    const data = await fetchHiddenJobs(p);
    setItems(data.items);
    setTotalPages(data.totalPages);
    setTotalItems(data.totalItems);
    setSelected(new Set());
  }

  useEffect(() => {
    load(page);
  }, [page]);

  useEffect(() => {
    if (!checkAllRef.current) return;
    const pageIds = items.map((j) => j.id);
    const selectedOnPage = pageIds.filter((id) => selected.has(id));
    checkAllRef.current.indeterminate =
      selectedOnPage.length > 0 && selectedOnPage.length < pageIds.length;
  }, [selected, items]);

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      items.forEach((j) => (checked ? next.add(j.id) : next.delete(j.id)));
      return next;
    });
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }

  async function handleRestore(id: string) {
    setRestoringId(id);
    try {
      await restoreHiddenJob(id);
      await load(page);
    } finally {
      setRestoringId(null);
    }
  }

  async function handlePurgeSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!window.confirm(`주의: 영구 삭제된 공고 데이터는 절대 복구할 수 없습니다.\n정말로 ${ids.length}개의 공고를 영구 삭제하시겠습니까?`))
      return;
    setBusy(true);
    try {
      await purgeSelectedHiddenJobs(ids);
      await load(page);
    } finally {
      setBusy(false);
    }
  }

  async function handlePurgeAll() {
    if (!window.confirm(`주의: 영구 삭제된 공고 데이터는 절대 복구할 수 없습니다.\n정말로 ${totalItems}개의 공고를 영구 삭제하시겠습니까?`))
      return;
    setBusy(true);
    try {
      await purgeAllHiddenJobs();
      await load(1);
      setPage(1);
    } finally {
      setBusy(false);
    }
  }

  const allOnPageSelected =
    items.length > 0 && items.every((j) => selected.has(j.id));

  if (totalItems === 0 && items.length === 0) {
    return <p className="admin-status">삭제된 공고가 없습니다.</p>;
  }

  return (
    <div>
      <div className="deleted-jobs-actions">
        <button
          className="purge-selected-btn"
          disabled={selected.size === 0 || busy || restoringId !== null}
          onClick={handlePurgeSelected}
        >
          선택 삭제 ({selected.size})
        </button>
        <button
          className="purge-all-btn"
          disabled={busy || restoringId !== null}
          onClick={handlePurgeAll}
        >
          일괄 영구 삭제
        </button>
      </div>

      <table className="run-table deleted-jobs-table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                ref={checkAllRef}
                checked={allOnPageSelected}
                onChange={(e) => toggleAll(e.target.checked)}
              />
            </th>
            <th>회사</th>
            <th>공고 제목</th>
            <th>지역</th>
            <th>삭제일</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((job) => (
            <tr key={job.id}>
              <td>
                <input
                  type="checkbox"
                  checked={selected.has(job.id)}
                  onChange={(e) => toggleOne(job.id, e.target.checked)}
                />
              </td>
              <td>{job.company}</td>
              <td>{job.title}</td>
              <td>{job.location}</td>
              <td>{formatDate(job.hiddenAt)}</td>
              <td>
                <button
                  className="restore-btn"
                  disabled={restoringId !== null || busy}
                  onClick={() => handleRestore(job.id)}
                >
                  복구
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

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
    </div>
  );
}

// ─── 즐겨찾기 관리 탭 ────────────────────────────────────────────────────────

function FavoritesTab() {
  const [items, setItems] = useState<JobPosting[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const data = await fetchFavoriteJobs();
    setItems(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUnfavorite(id: string) {
    setBusyId(id);
    try {
      await toggleFavorite(id);
      setItems((prev) => prev.filter((j) => j.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return <p className="admin-status">즐겨찾기한 공고가 없습니다.</p>;
  }

  return (
    <table className="run-table">
      <thead>
        <tr>
          <th>회사</th>
          <th>공고 제목</th>
          <th>지역</th>
          <th>마감일</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {items.map((job) => (
          <tr key={job.id}>
            <td>{job.company}</td>
            <td>{job.title}</td>
            <td>{job.location}</td>
            <td>{job.deadline ?? "상시채용"}</td>
            <td>
              <button
                className="unfavorite-btn"
                disabled={busyId === job.id}
                onClick={() => handleUnfavorite(job.id)}
              >
                ★ 해제
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── 배치 모니터링 및 제어 탭 ────────────────────────────────────────────────

function BatchMonitoringTab() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<RunRecord[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  async function loadRuns() {
    const data = await fetchRuns(page);
    setItems(data.items);
    setTotalPages(data.totalPages);
  }

  useEffect(() => {
    loadRuns();
  }, [page]);

  useEffect(() => {
    const hasRunning = items.some((item) => item.status === "running");
    if (!hasRunning && !pending) {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = window.setInterval(loadRuns, 4000);
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [items, pending, page]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAction(
    key: string,
    label: string,
    action: () => Promise<unknown>,
    doneMessage = `${label} 완료`
  ) {
    setPending(key);
    setActionStatus(`${label} 실행 중...`);
    try {
      await action();
      setActionStatus(doneMessage);
      setPage(1);
      await loadRuns();
    } catch {
      setActionStatus(`${label} 실패`);
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <div className="admin-controls">
        <div className="admin-control-row">
          <span>{JOB_LABELS.scrape}</span>
          <div className="admin-control-actions">
            <button
              disabled={pending !== null}
              onClick={() =>
                handleAction("scrape-today", "오늘 수집 초기화 후 재수집", () =>
                  runScrapeBatch("today")
                )
              }
            >
              오늘 수집 초기화 후 재수집
            </button>
            <button
              disabled={pending !== null}
              onClick={() =>
                handleAction("scrape-all", "전체 초기화 후 재수집", () => runScrapeBatch("all"))
              }
            >
              전체 초기화 후 재수집
            </button>
          </div>
        </div>

        <div className="admin-control-row">
          <span>{JOB_LABELS.notify}</span>
          <div className="admin-control-actions">
            <button
              disabled={pending !== null}
              onClick={() => handleAction("notify", "즉시 발송하기", runNotifyBatch)}
            >
              즉시 발송하기
            </button>
          </div>
        </div>

        <div className="admin-control-row">
          <span>{JOB_LABELS.aiBatch}</span>
          <div className="admin-control-actions">
            <button
              disabled={pending !== null}
              onClick={() =>
                handleAction(
                  "aiBatch",
                  "PENDING 초기화 후 즉시 추론",
                  runAiBatch,
                  "추론 시작됨 (아래 표에서 진행 상황 확인)"
                )
              }
            >
              PENDING 초기화 후 즉시 추론
            </button>
          </div>
        </div>
      </div>

      {actionStatus && <p className="admin-status">{actionStatus}</p>}

      <table className="run-table">
        <thead>
          <tr>
            <th>배치 이름</th>
            <th>일자</th>
            <th>시작 시간</th>
            <th>종료 시간</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {items.map((run) => (
            <Fragment key={run.id}>
              <tr
                className={run.status === "failed" ? "run-row-clickable" : undefined}
                onClick={() => run.status === "failed" && toggleExpand(run.id)}
              >
                <td>{JOB_LABELS[run.jobName] ?? run.jobName}</td>
                <td>{formatDate(run.date)}</td>
                <td>{formatTime(run.startedAt)}</td>
                <td>{formatTime(run.finishedAt)}</td>
                <td>
                  <span className={`status-badge ${run.status}`}>{STATUS_LABELS[run.status]}</span>
                </td>
              </tr>
              {run.status === "failed" && expanded.has(run.id) && (
                <tr>
                  <td colSpan={5}>
                    <pre className="run-error">{run.error}</pre>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>

      {items.length === 0 && <p>아직 실행 이력이 없습니다.</p>}

      {totalPages > 1 && (
        <div className="pagination">
          <div className="pagination-nav">
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
        </div>
      )}
    </div>
  );
}

// ─── 관리자 페이지 (탭 컨테이너) ─────────────────────────────────────────────

type AdminTab = "dashboard" | "favorites" | "batch";

export function AdminBatchPage() {
  const [tab, setTab] = useState<AdminTab>("batch");

  return (
    <div className="admin-batch">
      <h2>관리자</h2>
      <div className="admin-tabs">
        <button className={tab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}>
          대쉬보드 관리
        </button>
        <button className={tab === "favorites" ? "active" : ""} onClick={() => setTab("favorites")}>
          즐겨찾기 관리
        </button>
        <button className={tab === "batch" ? "active" : ""} onClick={() => setTab("batch")}>
          배치 모니터링 및 제어
        </button>
      </div>
      {tab === "dashboard" ? (
        <DashboardManagementTab />
      ) : tab === "favorites" ? (
        <FavoritesTab />
      ) : (
        <BatchMonitoringTab />
      )}
    </div>
  );
}
