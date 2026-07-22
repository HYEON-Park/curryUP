// 매칭표 텍스트에서 "종합 매칭률: N%" 값을 추출한다. 없으면 null.
export function parseMatchOverall(text: string | undefined | null): number | null {
  if (!text) return null;
  const m = text.match(/종합\s*매칭률\s*[:：]?\s*(\d+)\s*%/);
  return m ? Number(m[1]) : null;
}
