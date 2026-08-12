import type { EducationCategory } from "../types";

// 경력 — 직급/직책 옵션
export const POSITION_OPTIONS = [
  "사원", "주임", "대리", "과장", "차장", "부장",
  "팀장", "실장", "이사", "상무", "전무",
  "선임", "책임", "수석", "프로", "매니저", "기타",
];

// 학력 — 1단계 구분(라벨 ↔ category enum)
export const EDUCATION_LEVELS: { value: EducationCategory; label: string }[] = [
  { value: "ELEMENTARY", label: "초등학교 졸업" },
  { value: "MIDDLE", label: "중학교 졸업" },
  { value: "HIGH_SCHOOL", label: "고등학교 졸업" },
  { value: "UNIVERSITY", label: "대학·대학원 이상 졸업" },
  { value: "OTHER", label: "기타 학력 졸업" },
];

export function educationLevelLabel(category: EducationCategory): string {
  return EDUCATION_LEVELS.find((l) => l.value === category)?.label ?? "";
}

// 졸업 상태
export const EDUCATION_STATUS = ["졸업", "졸업예정", "재학", "휴학", "중퇴", "수료"];

// 고등학교 전공계열
export const HIGH_SCHOOL_TRACKS = [
  "문과계열", "이과계열", "전문(실업)계", "예체능계", "특성화/마이스터고", "특수목적고",
];

// 대학 구분(대학·대학원)
export const UNIVERSITY_DEGREE_TYPES = ["대학(2,3년)", "대학교(4년)", "대학원(석사)", "대학원(박사)"];

// 인정학력(직업전문학원·기타)
export const RECOGNIZED_LEVELS = ["대학(2,3년)", "대학교(4년)"];

// 주/야간
export const DAY_NIGHT_OPTIONS = ["주간", "야간"];

// 지역(시·도)
export const REGION_OPTIONS = [
  "서울", "경기", "인천", "부산", "대구", "대전", "광주", "울산", "세종",
  "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주", "해외",
];
