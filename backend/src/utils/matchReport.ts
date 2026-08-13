// 매칭표(documents.matchReport)에서 "종합 매칭률: N%" 값을 추출하는 단일 규칙.
// 프런트 utils/matchReport.ts·routes/jobs.ts와 동일 정규식을 공유한다(판정 규칙 한 곳).
export function matchOverallPercent(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/종합\s*매칭률\s*[:：]?\s*(\d+)\s*%/);
  return m ? Number(m[1]) : null;
}
