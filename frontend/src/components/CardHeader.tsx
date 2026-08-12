interface CardHeaderProps {
  index: number;
  summary: string;
  placeholder: string;
  collapsed: boolean;
  onToggle: () => void;
  onRemove: () => void;
}

// 경력/학력 카드 공통 헤더: 번호 뱃지 + 요약(회사명/학교명) + 접기 + 삭제
export function CardHeader({ index, summary, placeholder, collapsed, onToggle, onRemove }: CardHeaderProps) {
  return (
    <div className="entry-card-head">
      <div className="entry-card-head-left">
        <span className="entry-num">{index + 1}</span>
        <span className={summary ? "entry-summary" : "entry-summary placeholder"}>
          {summary || placeholder}
        </span>
      </div>
      <div className="entry-card-head-right">
        <button
          type="button"
          className="entry-collapse-btn"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "펼치기" : "접기"}
        >
          <span className={collapsed ? "chevron down" : "chevron up"} aria-hidden>
            ⌃
          </span>
        </button>
        <button type="button" className="entry-delete-btn" onClick={onRemove}>
          삭제
        </button>
      </div>
    </div>
  );
}
