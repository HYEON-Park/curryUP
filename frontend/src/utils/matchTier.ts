// 매칭률 → 티어 판정. 프런트/백엔드·여러 컴포넌트가 같은 규칙을 복제하지 않도록
// 판정 규칙을 이 한 곳에 둔다(색상 매핑: hi ≥70% / mid 60~70% / lo <60%).
export type MatchTier = "hi" | "mid" | "lo";

export function matchTier(pct: number): MatchTier {
  if (pct >= 70) return "hi";
  if (pct >= 60) return "mid";
  return "lo";
}
