export function formatDday(deadline: string | null): string {
  if (!deadline) return "마감일 미정";

  const match = deadline.match(/(\d{1,2})\/(\d{1,2})/);
  if (!match) return deadline;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let target = new Date(today.getFullYear(), month - 1, day);
  if (target < today) target = new Date(today.getFullYear() + 1, month - 1, day);

  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays === 0 ? "D-day" : `D-${diffDays}`;
}
