const WEEKDAYS_KR = ["일", "월", "화", "수", "목", "금", "토"];

// 마감일 문자열을 YY.MM.DD(요일) 한국 표준 형식으로 변환한다(예: "2026/08/23" → "26.08.23(일)").
// null이면 "상시채용", 날짜를 파싱하지 못하면 원본 문자열을 그대로 둔다(안전망).
export function formatDeadlineKR(deadline: string | null): string {
  if (!deadline) return "상시채용";
  const m = deadline.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!m) return deadline;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const date = new Date(year, month - 1, day);
  const yy = String(year % 100).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${yy}.${mm}.${dd}(${WEEKDAYS_KR[date.getDay()]})`;
}

export function formatDday(deadline: string | null): string {
  if (!deadline) return "마감일 미정";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const DAY = 1000 * 60 * 60 * 24;

  // 연도 포함 표기(YYYY/MM/DD) 우선. 저장된 연도를 그대로 신뢰한다(과거를 내년으로 밀지 않는다).
  const ym = deadline.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  // 연도 없는 레거시 표기(MM/DD) 안전망: 올해 기준.
  const md = ym ? null : deadline.match(/(\d{1,2})\/(\d{1,2})/);

  let target: Date | null = null;
  if (ym) target = new Date(Number(ym[1]), Number(ym[2]) - 1, Number(ym[3]));
  else if (md) target = new Date(today.getFullYear(), Number(md[1]) - 1, Number(md[2]));
  if (!target) return deadline;

  const diffDays = Math.round((target.getTime() - today.getTime()) / DAY);
  if (diffDays === 0) return "D-day";
  return diffDays > 0 ? `D-${diffDays}` : "마감";
}
