export interface UserProfile {
  yearsOfExperience: number | null;
  skills: string[];
  careerHistory: string;
  certifications: string[];
  locations: string[];
  desiredRoleCategories: string[];
  roleAnswers: Record<string, string>;
  lastProfileUpdate: string | null;
}

export interface GeneratedDocuments {
  coverLetter: string;
  intro: string;
  workExperience: string;
  generatedAt: string;
}

export interface JobPosting {
  id: string;
  sourceUrl: string;
  company: string;
  title: string;
  location: string;
  deadline: string | null;
  requiredYears: { min: number; max: number } | null;
  skills: string[];
  roleCategory: string | null;
  description: string;
  collectedAt: string;
  documents: GeneratedDocuments | null;
}

export interface JobsPage {
  items: JobPosting[];
  page: number;
  totalPages: number;
  totalItems: number;
}

export const ROLE_CATEGORIES = [
  "백엔드 개발",
  "프론트엔드 개발",
  "데이터 분석/엔지니어링",
  "AI/ML",
  "디자인",
  "기획/PM",
  "마케팅",
] as const;

export const ROLE_QUESTIONS: Record<string, string[]> = {
  "백엔드 개발": ["주로 사용한 데이터베이스는?", "대규모 트래픽/스케일링 경험이 있나요?"],
  "프론트엔드 개발": ["주로 사용한 프레임워크는?", "성능 최적화 경험이 있나요?"],
  "데이터 분석/엔지니어링": ["주로 사용한 데이터 파이프라인 툴은?", "다룬 데이터 규모는?"],
  "AI/ML": ["다룬 모델/프레임워크는?", "프로덕션 배포 경험이 있나요?"],
  "디자인": ["사용 툴은?", "포트폴리오 링크가 있나요?"],
  "기획/PM": ["담당했던 제품 단계는?", "협업한 팀 규모는?"],
  "마케팅": ["담당 채널은?", "성과 지표 경험이 있나요?"],
};
