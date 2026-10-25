// 매칭표(documents.matchReport)에서 "종합 매칭률: N%" 값을 추출하는 단일 규칙.
// 프런트 utils/matchReport.ts·routes/jobs.ts와 동일 정규식을 공유한다(판정 규칙 한 곳).
export function matchOverallPercent(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/종합\s*매칭률\s*[:：]?\s*(\d+)\s*%/);
  return m ? Number(m[1]) : null;
}

export interface MatchCriterion {
  label: string;
  grade: string;
  pct: number | null;
  reason: string;
}

// 기존 그래프의 등급 환산 기준을 유지한다. 종합 점수의 산식이 아니다.
const GRADE_BASE: Record<string, number> = {
  강: 100, 중강: 75, 중상: 75, 중: 50, 중약: 35, 약중: 35,
  약: 25, 하: 25, 없음: 0, 무: 0,
};

export function gradeToPct(rawGrade: string): number | null {
  const grade = rawGrade.replace(/\*\*/g, "").replace(/\([^)]*\)/g, "").replace(/\s/g, "");
  if (!grade || /^[—–-]$/.test(grade)) return null;
  const parts = grade.split(/[~〜–—/／-]/).filter(Boolean);
  if (!parts.length || parts.some((part) => GRADE_BASE[part] === undefined)) return null;
  return Math.round(parts.reduce((sum, part) => sum + GRADE_BASE[part], 0) / parts.length);
}

export function parseMatchReport(text: string): {
  overall: number | null; criteria: MatchCriterion[]; rest: string;
} {
  const lines = text.split(/\r?\n/);
  const consumed = new Set<number>();
  const criteria: MatchCriterion[] = [];
  let gradeIdx: number | null = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line.startsWith("|")) { gradeIdx = null; continue; }
    // 빈 근거 셀도 보존해 열 위치가 이동하지 않도록 한다.
    const cells = line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
    const headerIdx = cells.findIndex((cell) => /^(평가|매칭도|매칭)$/.test(cell.replace(/\*\*/g, "")));
    if (headerIdx > 0) { gradeIdx = headerIdx; consumed.add(index); continue; }
    if (gradeIdx === null) continue;
    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) { consumed.add(index); continue; }
    if (cells.length < 3 || !cells[0] || !cells[gradeIdx]) continue;
    const grade = cells[gradeIdx];
    criteria.push({ label: cells[0], grade, pct: gradeToPct(grade),
      reason: cells.filter((_, i) => i !== 0 && i !== gradeIdx).join(" | ") });
    consumed.add(index);
  }
  const overall = matchOverallPercent(text);
  // 표와 종합 점수만 차트로 대체한다. 앞뒤 설명·강점·갭은 보존한다.
  const rest = lines.filter((line, i) => !consumed.has(i)
    && !/^\s*(?:\[|\d+[).]\s*)?매칭률 사전 평가\]?\s*$/.test(line)
    && !/^\s*종합\s*매칭률\s*[:：]?\s*\d+\s*%\s*$/.test(line)).join("\n").trim();
  return { overall, criteria, rest };
}

export function validateMatchReport(text: string): void {
  const { overall, criteria } = parseMatchReport(text);
  if (overall === null || overall < 0 || overall > 100) throw new Error("종합 매칭률 형식 오류");
  // 미사용을 명시한 짧은 구절만 제외한다. 같은 문장·다른 줄의 산식 설명은 계속 검사한다.
  const weightingClaims = text.replace(
    /(?:임의(?:의)?\s*)?(?:가중치|가중합)(?:\s*(?:[·ㆍ/]|및|나|이나|또는)\s*(?:임의(?:의)?\s*)?(?:가중치|가중합|산식))*(?:\s*산식)?(?:은|는|을|를|도)?\s*(?:적용|사용|반영)하지\s*않(?:았습니다|았다|았음|습니다|는다|음)(?=\s*(?:[.!?。;,\n]|$))/g,
    "",
  );
  if (/가중치|가중합/.test(weightingClaims)) throw new Error("설정되지 않은 가중치 산식은 사용할 수 없습니다");
  const labels = ["필수 자격요건", "스택 매칭", "담당업무 매칭", "우대사항 매칭"];
  if (criteria.length !== labels.length || labels.some((label, i) => criteria[i]?.label !== label)) {
    throw new Error("매칭률 평가표는 필수 자격요건·스택·담당업무·우대사항 4개 항목이어야 합니다");
  }
  for (const criterion of criteria) {
    if (!/^(강|중강|중상|중|중약|약중|약|하|없음|무|-|—)$/.test(criterion.grade)
      || !criterion.reason.trim()) throw new Error(`평가 등급 또는 근거 오류: ${criterion.label}`);
  }
  if (!/강점\s*Top\s*3/i.test(text) || !/갭\s*Top\s*[3-5]/i.test(text) || !text.includes("지원 권장도")) {
    throw new Error("매칭률 평가표 강점·갭·지원 권장도 누락");
  }
}
