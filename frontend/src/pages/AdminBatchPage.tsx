import { Fragment, useEffect, useRef, useState } from "react";
import { fetchRuns, runAiBatch, runNotifyBatch, runScrapeBatch } from "../api/client";
import type { RunRecord } from "../types";

const JOB_LABELS: Record<string, string> = {
  scrape: "공고 스크래핑 배치",
  notify: "오전 프로필 알림 배치",
  aiBatch: "야간 AI 문서 생성 배치",
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

export function AdminBatchPage() {
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

  async function handleAction(key: string, label: string, action: () => Promise<unknown>, doneMessage = `${label} 완료`) {
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
    <div className="admin-batch">
      <h2>배치 관리자</h2>

      <div className="admin-controls">
        <div className="admin-control-row">
          <span>{JOB_LABELS.scrape}</span>
          <div className="admin-control-actions">
            <button
              disabled={pending !== null}
              onClick={() => handleAction("scrape-today", "오늘 수집 초기화 후 재수집", () => runScrapeBatch("today"))}
            >
              오늘 수집 초기화 후 재수집
            </button>
            <button
              disabled={pending !== null}
              onClick={() => handleAction("scrape-all", "전체 초기화 후 재수집", () => runScrapeBatch("all"))}
            >
              전체 초기화 후 재수집
            </button>
          </div>
        </div>

        <div className="admin-control-row">
          <span>{JOB_LABELS.notify}</span>
          <div className="admin-control-actions">
            <button disabled={pending !== null} onClick={() => handleAction("notify", "즉시 발송하기", runNotifyBatch)}>
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
                handleAction("aiBatch", "PENDING 초기화 후 즉시 추론", runAiBatch, "추론 시작됨 (아래 표에서 진행 상황 확인)")
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
