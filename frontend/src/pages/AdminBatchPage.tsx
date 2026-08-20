import { Fragment, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  fetchBatchUsers,
  fetchFavoriteJobs,
  fetchHiddenJobs,
  fetchRuns,
  purgeAllHiddenJobs,
  purgeSelectedHiddenJobs,
  restoreHiddenJob,
  runClosedCheckBatch,
  runMatchCheckBatch,
  runWriteDocsBatch,
  runScrapeBatch,
  setBatchUserEnabled,
  toggleFavorite,
  type BatchCandidate,
} from "../api/client";
import type { HiddenJobPosting, JobPosting, RunRecord } from "../types";
import { ensureProfileOrRedirect } from "../utils/profileGuard";
import { formatDeadlineKR } from "../utils/dday";

const JOB_LABELS: Record<string, string> = {
  scrape: "오늘 공고 수집",
  collect: "대시보드 수동 수집",
  /*notify: "오전 프로필 알림 배치",*/
  aiBatch: "야간 AI 문서 생성 배치",
  평점조회: "평점 조회 배치",
  매칭률조회: "매칭률 조회 배치",
  "write-documents": "문서 작성 배치",
  종료공고: "종료 공고 점검 배치",
};

const STATUS_LABELS: Record<RunRecord["status"], string> = {
  success: "성공",
  failed: "실패",
  running: "진행중",
};

// 실행 주체: 시스템 자동(Cron) vs 관리자 수동 실행 구분. 상태란에 "[자동] 성공"처럼 함께 표기한다.
const TRIGGER_LABELS: Record<RunRecord["trigger"], string> = {
  scheduled: "자동",
  manual: "수동",
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
            <td>{formatDeadlineKR(job.deadline)}</td>
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
  const navigate = useNavigate();
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
    doneMessage = `${label} 완료`,
    // 프로필이 없으면 매칭 기준이 없어 돌릴 수 없는 배치(스크래핑·매칭률·문서 작성)는 실행 전 가드한다.
    // 오전 프로필 알림 배치(notify)는 프로필과 무관하므로 false로 넘겨 가드에서 제외한다.
    requireProfile = true
  ) {
    if (requireProfile && !(await ensureProfileOrRedirect(navigate))) return;
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
          <span>공고 수집 / 종료 점검</span>
          <div className="admin-control-actions">
            <button
              disabled={pending !== null}
              onClick={() =>
                handleAction("scrape-today", "오늘 수집 초기화 후 재수집", () =>
                  runScrapeBatch("today")
                )
              }
            >
              공고 수집 배치
            </button>
            <button
              disabled={pending !== null}
              onClick={() =>
                handleAction(
                  "closed-check",
                  "종료 공고 점검",
                  runClosedCheckBatch,
                  "종료 점검 시작됨 (아래 표에서 진행 상황 확인)",
                  false
                )
              }
            >
              지금 종료 점검
            </button>
           {/* <button
              disabled={pending !== null}
              onClick={() =>
                handleAction("scrape-all", "전체 초기화 후 재수집", () => runScrapeBatch("all"))
              }
            >
              전체 초기화 후 재수집
            </button>*/}
          </div>
        </div>

        {/*<div className="admin-control-row">
          <span>{JOB_LABELS.notify}</span>
          <div className="admin-control-actions">
            <button
              disabled={pending !== null}
              onClick={() =>
                handleAction("notify", "즉시 발송하기", runNotifyBatch, "즉시 발송하기 완료", false)
              }
            >
              즉시 발송하기
            </button>
          </div>
        </div>*/}

        <div className="admin-control-row">
          <span>{JOB_LABELS.매칭률조회}</span>
          <div className="admin-control-actions">
            <button
              disabled={pending !== null}
              onClick={() =>
                handleAction(
                  "match-check",
                  "매칭률 조회 배치 실행",
                  runMatchCheckBatch,
                  "매칭률 조회 시작됨 (아래 표에서 진행 상황 확인)"
                )
              }
            >
              매칭률 조회 배치
            </button>
          </div>
        </div>

        <div className="admin-control-row">
          <span>{JOB_LABELS["write-documents"]}</span>
          <div className="admin-control-actions">
            <button
              disabled={pending !== null}
              onClick={() =>
                handleAction(
                  "write-documents",
                  "문서 작성 배치 실행",
                  runWriteDocsBatch,
                  "문서 작성 시작됨 (아래 표에서 진행 상황 확인)"
                )
              }
            >
              문서 작성 배치
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
                className={
                  run.status === "failed" || (run.closedJobs?.length ?? 0) > 0
                    ? "run-row-clickable"
                    : undefined
                }
                onClick={() =>
                  (run.status === "failed" || (run.closedJobs?.length ?? 0) > 0) &&
                  toggleExpand(run.id)
                }
              >
                <td>{JOB_LABELS[run.jobName] ?? run.jobName}</td>
                <td>{formatDate(run.date)}</td>
                <td>{formatTime(run.startedAt)}</td>
                <td>{formatTime(run.finishedAt)}</td>
                <td>
                  {/*<span className="run-trigger">[{TRIGGER_LABELS[run.trigger]}]</span>{" "}*/}
                  <span className={`status-badge ${run.status}`}>{TRIGGER_LABELS[run.trigger]} {STATUS_LABELS[run.status]}</span>
                </td>
              </tr>
              {expanded.has(run.id) &&
                (run.status === "failed" ? (
                  <tr>
                    <td colSpan={5}>
                      <pre className="run-error">{run.error}</pre>
                    </td>
                  </tr>
                ) : (run.closedJobs?.length ?? 0) > 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <ul className="closed-jobs-list">
                        {run.closedJobs!.map((c, i) => (
                          <li key={i}>
                            {c.company} — {c.title}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ) : null)}
            </Fragment>
          ))}
        </tbody>
      </table>

      {items.length === 0 && <p>아직 실행 이력이 없습니다.</p>}

      {totalPages > 1 && (
        <div className="pagination">
          <div className="pagination-nav">
            <button className="topbar-logout" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              이전
            </button>
            <span>
               {page} / {totalPages}
            </span>
            <button className="topbar-logout" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 배치 대상 등록 탭 ───────────────────────────────────────────────────────

// 가입 유저 목록에서 자동 배치(수집·매칭률·문서작성·알림·종료점검) 대상을 체크박스로 등록/해제한다.
// 등록(batchEnabled)된 유저만 스케줄 배치가 사용자별 순차로 돈다. 프로필 미충족 유저는 등록해도 배치에서 빠진다.
function BatchTargetTab() {
  const [users, setUsers] = useState<BatchCandidate[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setUsers(await fetchBatchUsers());
    } catch {
      setError("목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleToggle(user: BatchCandidate, enabled: boolean) {
    setBusyId(user.userId);
    setError(null);
    // 낙관적 업데이트: 실패 시 재조회로 되돌린다.
    setUsers((prev) => prev.map((u) => (u.userId === user.userId ? { ...u, batchEnabled: enabled } : u)));
    try {
      await setBatchUserEnabled(user.userId, enabled);
    } catch {
      setError("변경에 실패했습니다.");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="admin-status">불러오는 중...</p>;
  if (users.length === 0) return <p className="admin-status">가입한 사용자가 없습니다.</p>;

  const enabledCount = users.filter((u) => u.batchEnabled).length;

  return (
    <div>
      <p className="admin-status">
        등록된 배치 대상 <b>{enabledCount}</b>명 / 전체 {users.length}명 · 등록한 사용자만 스케줄 배치가 실행됩니다.
      </p>
      {error && <p className="doc-generate-error">{error}</p>}
      <table className="run-table">
        <thead>
          <tr>
            <th>이메일</th>
            <th>프로필</th>
            <th>마지막 로그인</th>
            <th>배치 등록</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.userId}>
              <td>{user.email}</td>
              <td>{user.profileConfigured ? "완료" : "미완료"}</td>
              <td>{user.lastLoginAt ? formatDate(user.lastLoginAt) : "-"}</td>
              <td>
                <label className="batch-toggle">
                  <input
                    type="checkbox"
                    checked={user.batchEnabled}
                    disabled={busyId === user.userId}
                    onChange={(e) => handleToggle(user, e.target.checked)}
                  />
                  <span>{user.batchEnabled ? "등록됨" : "미등록"}</span>
                </label>
                {user.batchEnabled && !user.profileConfigured && (
                  <span className="batch-warn"> · 프로필 미완료라 실제 배치에서는 제외됩니다</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 관리자 페이지 (탭 컨테이너) ─────────────────────────────────────────────

type AdminTab = "dashboard" | "favorites" | "batch" | "batch-targets";

export function AdminBatchPage() {
  const { me } = useAuth();
  // "배치 모니터링 및 제어"·"배치 대상 등록" 두 탭은 ADMIN 전용이다(백엔드도 requireAdmin로 이중 보호).
  // 일반 유저는 "대쉬보드 관리"·"즐겨찾기 관리"만 볼 수 있고, 기본 탭도 대쉬보드 관리로 연다.
  const isAdmin = me?.role === "ADMIN";
  const [tab, setTab] = useState<AdminTab>(isAdmin ? "batch" : "dashboard");

  // 혹시라도 상태가 ADMIN 전용 탭을 가리키면(권한 변화 등) 일반 유저에게는 대쉬보드로 강등한다.
  const effectiveTab: AdminTab = !isAdmin && (tab === "batch" || tab === "batch-targets") ? "dashboard" : tab;

  return (
    <div className="admin-batch">
      <h2>관리자</h2>
      <div className="admin-tabs">
        <button className={effectiveTab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}>
          대쉬보드 관리
        </button>
        <button className={effectiveTab === "favorites" ? "active" : ""} onClick={() => setTab("favorites")}>
          즐겨찾기 관리
        </button>
        {isAdmin && (
          <button className={effectiveTab === "batch" ? "active" : ""} onClick={() => setTab("batch")}>
            배치 모니터링 및 제어
          </button>
        )}
        {isAdmin && (
          <button
            className={effectiveTab === "batch-targets" ? "active" : ""}
            onClick={() => setTab("batch-targets")}
          >
            배치 대상 등록
          </button>
        )}
      </div>
      {effectiveTab === "dashboard" ? (
        <DashboardManagementTab />
      ) : effectiveTab === "favorites" ? (
        <FavoritesTab />
      ) : effectiveTab === "batch" ? (
        <BatchMonitoringTab />
      ) : (
        <BatchTargetTab />
      )}
    </div>
  );
}
