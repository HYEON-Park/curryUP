// 매칭표 텍스트에서 "종합 매칭률: N%" 값을 추출한다. 없으면 null.
export function parseMatchOverall(text: string | undefined | null): number | null {
  if (!text) return null;
  const m = text.match(/종합\s*매칭률\s*[:：]?\s*(\d+)\s*%/);
  return m ? Number(m[1]) : null;
}

// 공고의 매칭률 평가표를 반환한다. 전체 문서 작성 배치가 만든 documents.matchReport가 있으면
// 그쪽을(최신 평가), 없으면 매칭률 조회 배치가 채운 top-level matchReport를 사용한다.
export function resolveMatchReport(job: {
  documents?: { matchReport?: string } | null;
  matchReport?: string;
}): string | undefined {
  return job.documents?.matchReport ?? job.matchReport;
}
