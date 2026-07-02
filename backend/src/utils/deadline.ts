// 스크래퍼가 내려주는 deadline은 "~ 07/18(토)" 같은 날짜 표기 외에 "오늘마감"/"내일마감"/
// "모레마감"/"상시채용"/"채용시" 같은 텍스트로도 온다. 날짜 표기가 없는 상시채용류는 마감
// 기준이 없으므로 null(마감일 없음)을 반환한다.
export function daysUntilDeadline(deadline: string | null): number | null {
  if (!deadline) return null;

  if (deadline.includes("오늘마감")) return 0;
  if (deadline.includes("내일마감")) return 1;
  if (deadline.includes("모레마감")) return 2;

  const match = deadline.match(/(\d{1,2})\/(\d{1,2})/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let target = new Date(today.getFullYear(), month - 1, day);
  if (target < today) target = new Date(today.getFullYear() + 1, month - 1, day);

  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
