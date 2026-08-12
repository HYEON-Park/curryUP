import type { CareerEntry, CareerInfo, EducationEntry, EducationInfo } from "../types";
import { educationLevelLabel } from "../data/profileFormMeta";

// 현재 YYYYMM
export function currentYM(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// YYYYMM 유효성: 6자리 숫자 + 월 01~12 + 연도 1900~2100
export function isValidYM(ym: string): boolean {
  if (!/^\d{6}$/.test(ym)) return false;
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  return year >= 1900 && year <= 2100 && month >= 1 && month <= 12;
}

// YYYYMM → "YYYY.MM"
export function formatYM(ym: string): string {
  return isValidYM(ym) ? `${ym.slice(0, 4)}.${ym.slice(4, 6)}` : ym;
}

// 두 YYYYMM 사이 개월 수(양끝 포함). 유효하지 않으면 0.
export function monthsBetween(startYM: string, endYM: string): number {
  if (!isValidYM(startYM) || !isValidYM(endYM)) return 0;
  const s = Number(startYM.slice(0, 4)) * 12 + Number(startYM.slice(4, 6));
  const e = Number(endYM.slice(0, 4)) * 12 + Number(endYM.slice(4, 6));
  return Math.max(0, e - s + 1);
}

// 경력 카드 1개의 개월 수(재직중이면 현재까지).
export function careerMonths(c: CareerEntry): number {
  const end = c.isWorking ? currentYM() : c.endYM;
  return monthsBetween(c.startYM, end);
}

// 총 개월 → "N년 N개월"
export function formatExperience(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0 && m === 0) return "0개월";
  if (y === 0) return `${m}개월`;
  if (m === 0) return `${y}년`;
  return `${y}년 ${m}개월`;
}

// 총 경력 개월 수(카드 단순 합산).
export function totalCareerMonths(careers: CareerEntry[]): number {
  return careers.reduce((sum, c) => sum + careerMonths(c), 0);
}

// 매칭·가드가 쓰는 yearsOfExperience 파생(반올림). 카드가 없으면 null.
export function deriveYearsOfExperience(careers: CareerEntry[]): number | null {
  if (careers.length === 0) return null;
  return Math.round(totalCareerMonths(careers) / 12);
}

// 글자 수 / byte(한글 등 멀티바이트 2, ASCII 1)
export function charCount(text: string): number {
  return [...text].length;
}
export function byteCount(text: string): number {
  let bytes = 0;
  for (const ch of text) bytes += ch.charCodeAt(0) > 127 ? 2 : 1;
  return bytes;
}

// 구조화 경력 → careerHistory 텍스트(문서 배치 호환).
export function careerInfoToText(info: CareerInfo | undefined): string {
  if (!info || info.careers.length === 0) return "";
  return info.careers
    .map((c) => {
      const period = `${formatYM(c.startYM)} ~ ${c.isWorking ? "재직중" : formatYM(c.endYM)}`;
      const head = [c.companyName, c.jobTitle, c.position].filter(Boolean).join(" · ");
      const meta = [period, c.department].filter(Boolean).join(" | ");
      const lines = [`${head} (${meta})`];
      if (c.description.trim()) lines.push(c.description.trim());
      return lines.join("\n");
    })
    .join("\n\n");
}

// 구조화 학력 → education 텍스트(문서 배치 호환).
export function educationInfoToText(info: EducationInfo | undefined): string {
  if (!info || info.educations.length === 0) return "";
  return info.educations
    .map((e) => {
      const kind = e.degreeType || e.recognizedLevel || educationLevelLabel(e.category);
      const name = [e.major || e.field, e.schoolName].filter(Boolean).join(" · ");
      const period =
        e.startYM || e.endYM ? ` ${formatYM(e.startYM)} ~ ${formatYM(e.endYM)}` : "";
      const extra = [e.status, e.gpa ? `학점 ${e.gpa}` : "", e.track, e.region]
        .filter(Boolean)
        .join(", ");
      return `${name} (${[kind, extra].filter(Boolean).join(", ")})${period}`.trim();
    })
    .join("\n");
}

// 최고 학력 라벨(가장 높은 구분).
const LEVEL_RANK: Record<string, number> = {
  ELEMENTARY: 1,
  MIDDLE: 2,
  HIGH_SCHOOL: 3,
  OTHER: 4,
  UNIVERSITY: 5,
};
export function deriveHighestLevel(educations: EducationEntry[]): string {
  if (educations.length === 0) return "";
  const top = [...educations].sort(
    (a, b) => (LEVEL_RANK[b.category] ?? 0) - (LEVEL_RANK[a.category] ?? 0)
  )[0];
  return top.degreeType || top.recognizedLevel || educationLevelLabel(top.category);
}
