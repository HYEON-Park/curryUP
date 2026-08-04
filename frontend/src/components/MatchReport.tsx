import { matchTier } from "../utils/matchTier";

interface Criterion {
  label: string;
  grade: string;
  pct: number;
  reason: string;
}

interface ParsedReport {
  overall: number | null;
  criteria: Criterion[];
  rest: string;
}

// 등급 표현 → 백분율. "약~중"처럼 범위로 오면 양끝 평균을 쓴다.
const GRADE_BASE: Record<string, number> = {
  강: 100,
  중강: 75,
  중상: 75,
  중: 50,
  중약: 35,
  약중: 35,
  약: 25,
  하: 25,
  없음: 0,
  무: 0,
};

function gradeToPct(rawGrade: string): number | null {
  const g = rawGrade.replace(/\s/g, "");
  if (g === "" || g === "-" || g === "—") return null; // 시그널 없음
  const parts = g.split(/[~〜–—-]/).filter(Boolean);
  const vals = parts.map((p) => GRADE_BASE[p]).filter((v) => v !== undefined);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// 매칭 강도 → 고추 개수. 등급 '앞 글자' 기준: 강 🌶️×3 / 중 🌶️×2 / 약·하 🌶️×1.
// '중강'·'중상'·'중약'처럼 중으로 시작하면 2개, '약~중'처럼 약으로 시작하면 1개.
// 없음·무·시그널 없음은 고추 없이 등급 텍스트만 노출한다.
function chiliCount(rawGrade: string): number {
  const first = rawGrade.replace(/\s/g, "")[0];
  if (first === "강") return 3;
  if (first === "중") return 2;
  if (first === "약" || first === "하") return 1;
  return 0;
}

// pct 구간별 색 (강→약, 초록→빨강). 사용자 제공 팔레트 기준.
function colorFor(pct: number | null): string {
  if (pct === null) return "#b8b5ac";
  if (pct >= 88) return "#1D9E75";
  if (pct >= 62) return "#639922";
  if (pct >= 37) return "#BA7517";
  return "#E24B4A";
}

function parseReport(text: string): ParsedReport {
  const overallMatch = text.match(/종합\s*매칭률\s*[:：]?\s*(\d+)\s*%/);
  const overall = overallMatch ? Number(overallMatch[1]) : null;

  const criteria: Criterion[] = [];
  // 등급 열 위치는 헤더 행에서 찾는다. 배치 출력이 3열(| 항목 | 평가 | 근거 |)일 때도,
  // 4열(| 구분 | 공고 요구 | 보유 여부 | 매칭도 |)처럼 변형돼도 등급 열만 올바르게 집는다.
  let gradeIdx = 1; // 헤더를 못 찾으면 기존 3열 형식(2번째 열이 등급)으로 간주
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const cells = trimmed
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length < 3) continue;
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // 구분선
    const headerIdx = cells.findIndex((c) => c === "평가" || c === "매칭도");
    if (headerIdx > 0) {
      gradeIdx = headerIdx; // 헤더 행: 등급 열 위치만 기억하고 데이터로는 쓰지 않는다
      continue;
    }
    const label = cells[0];
    const grade = cells[gradeIdx] ?? "";
    const reason = cells.filter((_, i) => i !== 0 && i !== gradeIdx).join(" | ");
    criteria.push({ label, grade, pct: gradeToPct(grade) ?? 0, reason });
  }

  // 차트로 뽑아낸 "매칭률 사전 평가" 블록을 제거한 나머지 본문 (강점/갭/권장도 등)
  let rest = text;
  const overallIdx = overallMatch ? text.indexOf(overallMatch[0]) : -1;
  if (overallIdx >= 0) {
    rest = text.slice(overallIdx + overallMatch![0].length);
  }
  rest = rest.replace(/^\s+/, "");

  return { overall, criteria, rest };
}

export function MatchReport({ text }: { text: string }) {
  const { overall, criteria, rest } = parseReport(text);

  // 파싱 실패(표가 없거나 형식이 다름) 시 원문을 그대로 노출해 정보 손실을 막는다.
  if (criteria.length === 0) {
    return <pre className="doc-content">{text}</pre>;
  }

  return (
    <div className="doc-content match-report">
      <div className="match-chart">
        <div className="match-chart-head">
          <span className="match-chart-title">매칭률 사전 평가</span>
          {overall !== null && (
            <div className={`match-stamp tier-${matchTier(overall)}`}>
              <span className="match-stamp-score">{overall}%</span>
              <span className="match-stamp-tag">종합</span>
            </div>
          )}
        </div>
        <ul className="match-chart-list">
          {criteria.map((c, i) => {
            const color = colorFor(gradeToPct(c.grade));
            return (
              <li key={i} className="match-row">
                <div className="match-row-head">
                  <span className="match-row-label">{c.label}</span>
                  <span className="match-row-grade" style={{ color }}>
                    {"🌶️".repeat(chiliCount(c.grade))} {c.grade}
                  </span>
                </div>
                <div className="match-bar-track">
                  <div className="match-bar-fill" style={{ width: `${c.pct}%`, background: color }} />
                </div>
                {c.reason && <p className="match-row-reason">{c.reason}</p>}
              </li>
            );
          })}
        </ul>
      </div>
      {rest.trim() && <pre className="match-report-rest">{rest}</pre>}
    </div>
  );
}
