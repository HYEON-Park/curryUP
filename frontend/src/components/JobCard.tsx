import { Link } from "react-router-dom";
import type { JobPosting } from "../types";
import { formatDday } from "../utils/dday";
import { parseMatchOverall } from "../utils/matchReport";
import { matchTier } from "../utils/matchTier";
import { MatchRingBadge } from "./MatchRingBadge";

function sourceLabel(sourceUrl: string): string {
  if (sourceUrl.includes("jobkorea.co.kr")) return "J";
  if (sourceUrl.includes("saramin.co.kr")) return "S";
  return "?";
}

interface JobCardProps {
  job: JobPosting;
  highlighted?: boolean;
  today?: boolean;
  onFavorite: (id: string) => void;
  onDelete: (id: string) => void;
}

// 대시보드/추천에서 재사용하는 채용공고 카드.
// 카드 전체는 상세로 이동하는 Link이고, ★/✕ 클릭은 stopPropagation으로 카드 이동과 분리한다.
// 종료(disabled) 공고는 흐리게 표시하고 이동·즐겨찾기를 막되, ✕(수동 삭제)만 살려둔다.
export function JobCard({ job, highlighted, today, onFavorite, onDelete }: JobCardProps) {
  const overall = parseMatchOverall(job.documents?.matchReport);
  const tier = overall === null ? "lo" : matchTier(overall);
  const disabled = job.disabled === true;

  const inner = (
    <>
      <MatchRingBadge pct={overall} />
      {disabled && <span className="job-card-closed-badge">종료</span>}

      <div className="job-card-company">
        <span className="job-source">{sourceLabel(job.sourceUrl)}</span>
        <span className="job-card-name">{job.company}</span>
        <span className="job-rating">({job.rating ?? "—"})</span>
      </div>
      <div className="job-card-loc">{job.location}</div>
      <div className="job-card-title">{job.title}</div>

      <div className="job-card-foot">
        <span className={`dday dday-${tier}`}>{formatDday(job.deadline)}</span>
        <div className="job-card-actions">
          {!disabled && (
            <button
              type="button"
              className={`job-icon-btn job-fav${job.isFavorite ? " favorited" : ""}`}
              title={job.isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onFavorite(job.id);
              }}
            >
              {job.isFavorite ? "★" : "☆"}
            </button>
          )}
          <button
            type="button"
            className="job-icon-btn job-del"
            title="삭제"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(job.id);
            }}
          >
            ✕
          </button>
        </div>
      </div>
    </>
  );

  // 종료 공고: 상세 이동 링크 없이 비활성 카드로 렌더한다(✕ 버튼만 동작).
  if (disabled) {
    return <div className="job-card job-card-disabled">{inner}</div>;
  }

  // 카드 전체를 링크로 감싸면 <a> 안에 ★/✕ 버튼이 중첩돼 유효하지 않은 마크업이 된다.
  // stretched-link 패턴: 카드는 div로 두고, 카드를 덮는 투명 오버레이 <Link>로 이동을 처리하고
  // 액션 버튼은 오버레이 위(z-index)에 올려 별개 컨트롤로 남긴다.
  return (
    <div
      className={`job-card${highlighted ? " job-card-highlight" : ""}${today ? " job-card-today" : ""}`}
    >
      <Link
        to={`/jobs/${job.id}`}
        className="job-card-link"
        aria-label={`${job.company} ${job.title} 상세 보기`}
      />
      {inner}
    </div>
  );
}
