export interface UserProfile {
  yearsOfExperience: number | null;
  skills: string[];
  careerHistory: string;
  certifications: string[];
  locations: string[];
  desiredRoleCategories: string[];
  roleAnswers: Record<string, string>;
  lastProfileUpdate: string | null;
  sideProjects?: string;             // ← 추가 권장
  learningStack?: string;            // ← 추가 권장 (현재 학습 중인 기술)
  aiToolUsage?: string;              // ← 추가 권장 (AI 도구 활용 경험)
}

export interface JobPosting {
  id: string;
  sourceUrl: string;
  company: string;
  title: string;
  location: string;
  deadline: string | null;
  requiredYears: { min: number; max: number } | null;
  preferredSkills?: string[];        // ← 추가 권장 (우대사항)
  skills: string[];
  roleCategory: string | null;
  description: string;
  collectedAt: string;
  documents: GeneratedDocuments | null;
  responsibilities?: string;         // ← 추가 권장 (담당업무 원문)
  essayQuestions?: string[];         // ← 추가 권장 (자소서 문항)
  charLimit?: string;                // ← 추가 권장 (글자수 제한)
  isFavorite?: boolean;
  rating?: string | null;
  ratingUpdatedAt?: string | null;
}

export interface GeneratedDocuments {
  coverLetter: string;
  intro: string;
  workExperience: string;
  generatedAt: string;
}

export interface HiddenJobPosting extends JobPosting {
  hiddenAt: string;
}

export interface RunProgress {
  total: number;
  completed: number;
  currentTitle: string | null;
}

export interface RunRecord {
  id: string;
  jobName: string;
  trigger: "scheduled" | "manual";
  date: string;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "success" | "failed";
  error?: string;
  progress?: RunProgress;
}

export interface RunsPage {
  items: RunRecord[];
  page: number;
  totalPages: number;
  totalItems: number;
}

export const ROLE_CATEGORIES = [
  "백엔드 개발",
  "프론트엔드 개발",
  "풀스택 개발",
  "모바일 개발",
  "데이터 엔지니어링",
  "데이터 분석/사이언스",
  "AI/ML",
  "DevOps/인프라",
  "QA/테스트",
  "보안",
  "게임 개발",
  "임베디드/하드웨어",
  "UX/UI 디자인",
  "그래픽/브랜드 디자인",
  "기획/PM",
  "마케팅",
  "영업/세일즈",
  "인사/HR",
  "재무/회계",
  "고객지원/CS",
  "운영/오퍼레이션",
] as const;

export const ROLE_QUESTIONS: Record<string, string[]> = {
  "백엔드 개발": ["주로 사용한 데이터베이스는?", "대규모 트래픽/스케일링 경험이 있나요?"],
  "프론트엔드 개발": ["주로 사용한 프레임워크는?", "성능 최적화 경험이 있나요?"],
  "풀스택 개발": ["선호하는 프론트/백엔드 조합은?", "기획부터 배포까지 혼자 진행한 경험이 있나요?"],
  "모바일 개발": ["주력 플랫폼은? (iOS/Android/크로스플랫폼)", "출시한 앱의 다운로드/사용자 규모는?"],
  "데이터 엔지니어링": ["주로 사용한 데이터 파이프라인 툴은?", "다룬 데이터 규모는?"],
  "데이터 분석/사이언스": ["주로 사용한 분석 툴/언어는?", "비즈니스 임팩트로 이어진 분석 사례가 있나요?"],
  "AI/ML": ["다룬 모델/프레임워크는?", "프로덕션 배포 경험이 있나요?"],
  "DevOps/인프라": ["주로 사용한 클라우드/IaC 툴은?", "무중단 배포·장애 대응 경험이 있나요?"],
  "QA/테스트": ["주로 사용한 테스트 자동화 툴은?", "발견한 주요 결함/개선 사례가 있나요?"],
  "보안": ["주력 보안 분야는? (인프라/앱/침해대응)", "보안 인증·취약점 진단 경험이 있나요?"],
  "게임 개발": ["주력 엔진은? (Unity/Unreal 등)", "출시·런칭에 참여한 경험이 있나요?"],
  "임베디드/하드웨어": ["주로 다룬 MCU/SoC는?", "양산 단계까지 참여한 경험이 있나요?"],
  "UX/UI 디자인": ["사용 툴은?", "포트폴리오 링크가 있나요?"],
  "그래픽/브랜드 디자인": ["사용 툴은?", "포트폴리오 링크가 있나요?"],
  "기획/PM": ["담당했던 제품 단계는?", "협업한 팀 규모는?"],
  "마케팅": ["담당 채널은?", "성과 지표 경험이 있나요?"],
  "영업/세일즈": ["담당했던 고객군은? (B2B/B2C)", "대표 성과(매출/계약 등)가 있나요?"],
  "인사/HR": ["담당 영역은? (채용/HRD/HRM)", "함께한 조직 규모는?"],
  "재무/회계": ["담당 영역은? (회계/세무/재무기획)", "사용한 회계 시스템(ERP)은?"],
  "고객지원/CS": ["담당 채널은? (전화/채팅/이메일)", "응대 규모/만족도 지표 경험이 있나요?"],
  "운영/오퍼레이션": ["담당 영역은?", "프로세스 개선 사례가 있나요?"],
};
