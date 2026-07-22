// 스크래퍼가 내려주는 deadline은 "~ 2026/07/19(금)" 같은 (연도 포함) 날짜 표기 외에
// "오늘마감"/"내일마감"/"모레마감"/"상시채용"/"채용시" 같은 텍스트로도 온다. 날짜 표기가 없는
// 상시채용류는 마감 기준이 없으므로 null(마감일 없음)을 반환한다.
export function daysUntilDeadline(deadline: string | null): number | null {
  if (!deadline) return null;

  if (deadline.includes("오늘마감")) return 0;
  if (deadline.includes("내일마감")) return 1;
  if (deadline.includes("모레마감")) return 2;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const DAY = 1000 * 60 * 60 * 24;

  // 연도 포함 표기(YYYY/MM/DD): 저장된 연도를 그대로 신뢰한다. 과거면 음수, 미래면 양수.
  // (연도 없이 MM/DD만 볼 때 과거를 내년으로 밀어 D-day가 뒤바뀌던 문제를 없앤다.)
  const ym = deadline.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (ym) {
    const target = new Date(Number(ym[1]), Number(ym[2]) - 1, Number(ym[3]));
    return Math.round((target.getTime() - today.getTime()) / DAY);
  }

  // 연도 없는 레거시 표기(MM/DD) 안전망: 올해 기준으로만 계산하고 내년으로 밀지 않는다.
  const md = deadline.match(/(\d{1,2})\/(\d{1,2})/);
  if (!md) return null;
  const target = new Date(today.getFullYear(), Number(md[1]) - 1, Number(md[2]));
  return Math.round((target.getTime() - today.getTime()) / DAY);
}

// "~ 07/19(금)"·"07/19" 같은 연도 없는 MM/DD 표기에 연도를 붙여 "~ 2026/07/19(금)" 형태로 만든다.
// 이미 연도가 있으면 그대로, 날짜가 아닌 표기(상시채용·채용시·오늘마감 등)도 그대로 둔다.
// 연도는 reference(수집 시각) 연도를 쓰되, MM/DD가 reference보다 두 달 이상 과거면 다음 해로 본다
// (연말에 수집한 '내년 초 마감' 공고 보정). 장식("~ ", "(요일)")은 그대로 보존한다.
export function resolveDeadlineYear(deadline: string | null, reference: Date = new Date()): string | null {
  if (!deadline) return deadline;
  if (/\d{4}\/\d{1,2}\/\d{1,2}/.test(deadline)) return deadline; // 이미 연도 포함
  const m = deadline.match(/(\d{1,2})\/(\d{1,2})/);
  if (!m) return deadline; // 상시채용·채용시·오늘마감 등 날짜 아님
  const month = Number(m[1]);
  const day = Number(m[2]);
  const ref = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  let year = reference.getFullYear();
  const candidate = new Date(year, month - 1, day);
  const GRACE_MS = 60 * 24 * 60 * 60 * 1000;
  if (candidate.getTime() < ref.getTime() - GRACE_MS) year += 1;
  const yyyymmdd = `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
  return deadline.replace(/\d{1,2}\/\d{1,2}/, yyyymmdd);
}
