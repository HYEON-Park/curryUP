import type { MatchThreshold } from "../hooks/useJobFilters";

interface FilterRailProps {
  regions: string[];
  region: string;
  matchThreshold: MatchThreshold;
  onRegionChange: (region: string) => void;
  onMatchThresholdChange: (t: MatchThreshold) => void;
}

const THRESHOLDS: { label: string; value: MatchThreshold }[] = [
  { label: "전체", value: 0 },
  { label: "50% 이상", value: 50 },
  { label: "60% 이상", value: 60 },
  { label: "70% 이상", value: 70 },
  { label: "80% 이상", value: 80 },
];

// 대시보드 좌측 필터 레일. 지역 셀렉트 + 매칭률(threshold) 셀렉트.
// 검색어와 함께 AND 조합으로 클라이언트 측에서 목록을 필터링한다(useJobFilters).
export function FilterRail({
  regions,
  region,
  matchThreshold,
  onRegionChange,
  onMatchThresholdChange,
}: FilterRailProps) {
  return (
    <aside className="filter-rail">
      <div className="filter-group">
        <div className="filter-label">지역</div>
        <select
          className="filter-select"
          value={region}
          onChange={(e) => onRegionChange(e.target.value)}
        >
          <option value="all">전체</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <div className="filter-label">매칭률</div>
        <select
          className="filter-select"
          value={matchThreshold}
          onChange={(e) => onMatchThresholdChange(Number(e.target.value) as MatchThreshold)}
        >
          {THRESHOLDS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
    </aside>
  );
}
