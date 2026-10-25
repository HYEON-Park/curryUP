import { matchTier } from "../utils/matchTier";

import { parseMatchReport } from "../../../backend/src/utils/matchReport";

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

export function MatchReport({ text }: { text: string }) {
  const { overall, criteria, rest } = parseMatchReport(text);

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
            const color = colorFor(c.pct);
            return (
              <li key={i} className="match-row">
                <div className="match-row-head">
                  <span className="match-row-label">{c.label}</span>
                  <span className="match-row-grade" style={{ color }}>
                    <span aria-hidden>{"🌶️".repeat(chiliCount(c.grade))}</span> {c.grade}
                  </span>
                </div>
                {c.pct !== null ? <div className="match-bar-track">
                  <div className="match-bar-fill" style={{ width: `${c.pct}%`, background: color }} />
                </div> : <p className="match-row-reason">평가 정보 없음</p>}
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
