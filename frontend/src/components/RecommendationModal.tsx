import { useEffect, useState } from "react";
import type { JobPosting } from "../types";
import { parseMatchOverall } from "../utils/matchReport";

interface Props {
  items: JobPosting[];
  onClose: () => void;
}

// 수동 업데이트 파이프라인 4단계: 오늘 수집분 중 매칭률 70% 이상 공고를 중앙 레이어 팝업으로 제안한다.
// 공고 카드 클릭 → 상세 페이지를 새 탭으로 연다(현재 화면 유지). [X]/배경/ESC → fade-out 후 닫힌다.
export function RecommendationModal({ items, onClose }: Props) {
  const [closing, setClosing] = useState(false);

  function handleClose() {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, 200); // fade-out 애니메이션 후 언마운트
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`rec-overlay${closing ? " closing" : ""}`} onClick={handleClose}>
      <div className={`rec-modal${closing ? " closing" : ""}`} onClick={(e) => e.stopPropagation()}>
        <button className="rec-close" onClick={handleClose} aria-label="닫기">
          ×
        </button>
        <h2 className="rec-title">추천 공고</h2>
        <p className="rec-subtitle">최근 수집된 공고 중 매칭률 70% 이상인 맞춤형 공고입니다.</p>
        <div className="rec-list">
          {items.map((job) => {
            const pct = parseMatchOverall(job.documents?.matchReport);
            return (
              <a
                key={job.id}
                className="rec-card"
                href={`/jobs/${job.id}`}
                target="_blank"
                rel="noreferrer"
              >
                <div className="rec-card-main">
                  <span className="rec-company">{job.company}</span>
                  <span className="rec-role">{job.title}</span>
                </div>
                {pct !== null && <span className="rec-badge">{pct}%</span>}
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
