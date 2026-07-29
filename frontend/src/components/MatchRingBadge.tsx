import { matchTier } from "../utils/matchTier";

// 매칭률 링 배지(40×40). 배경 트랙 + 티어색 진행 스트로크 + 중앙 % 텍스트.
// pct가 null이면(매칭표 없음) 진행 스트로크 없이 "—"만 표시한다.
// r=17 → 둘레 ≈ 107, dasharray는 pct * 1.07로 채운다.
export function MatchRingBadge({ pct }: { pct: number | null }) {
  const tier = pct === null ? "lo" : matchTier(pct);
  const dash = pct === null ? 0 : Math.max(0, Math.min(100, pct)) * 1.07;

  return (
    <svg
      className="match-ring"
      width="40"
      height="40"
      viewBox="0 0 40 40"
      role="img"
      aria-label={pct === null ? "매칭률 미산정" : `매칭률 ${pct}%`}
    >
      <circle cx="20" cy="20" r="17" fill="none" stroke="var(--border)" strokeWidth="3.5" />
      {pct !== null && (
        <circle
          cx="20"
          cy="20"
          r="17"
          fill="none"
          stroke={`var(--match-${tier})`}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${dash} 107`}
          transform="rotate(-90 20 20)"
        />
      )}
      <text x="20" y="21" className={`match-ring-text match-ring-${tier}`}>
        {pct === null ? "—" : `${pct}%`}
      </text>
    </svg>
  );
}
