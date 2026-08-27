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
  // 자소서 개인 자산(코드는 읽지 않고 문서 작성 배치만 참조). 프로필 페이지에서 입력한다.
  slogan?: string;                   // 대표 슬로건 (문서마다 1회 이상 등장)
  careerNarrative?: string;          // 커리어 서사 (예: SI→자체 솔루션)
  education?: string;                // 학력 (educationInfo에서 파생, 문서 배치 호환용)
  careerDirection?: string;          // 커리어 방향성
  interestDomains?: string;          // 관심 도메인
  representativeMetrics?: string;    // 대표 수치 세트 (자소서 수치화용)
  // 구조화 경력/학력. careerHistory·education 텍스트는 문서 배치 호환용으로 파생 저장한다.
  careerInfo?: CareerInfo;
  educationInfo?: EducationInfo;
}

export interface CareerEntry {
  companyName: string;
  startYM: string;                   // YYYYMM
  endYM: string;                     // YYYYMM (재직중이면 빈 값)
  isWorking: boolean;
  jobTitle: string;
  department: string;
  position: string;
  description: string;
}

export interface CareerInfo {
  totalExperience: string;           // "4년 11개월" — careers에서 파생
  careers: CareerEntry[];
}

export type EducationCategory = "ELEMENTARY" | "MIDDLE" | "HIGH_SCHOOL" | "UNIVERSITY" | "OTHER";

export interface EducationEntry {
  category: EducationCategory;
  schoolName: string;
  status: string;                    // 졸업/재학/중퇴 등
  startYM: string;
  endYM: string;
  isGED?: boolean;                   // 대입 검정고시
  isTransfer?: boolean;              // 편입
  track?: string;                    // 전공계열
  degreeType?: string;               // 대학(2,3년)/대학교(4년)/대학원(석사)/대학원(박사)
  major?: string;
  gpa?: string;
  subMajor?: string;                 // 추가전공
  dayNight?: string;                 // 주/야간
  recognizedLevel?: string;          // 인정학력
  field?: string;                    // 전공분야
  region?: string;
}

export interface EducationInfo {
  highestLevel: string;              // educations에서 파생
  educations: EducationEntry[];
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
  postingBody?: string;              // 모집공고 본문 원문(플레인 텍스트). 잡코리아는 목록 수집 시, 사람인은 상세 조회(fetchPostingBody)로 채운다. 이전 수집분은 UPDATE 시 백필된다.
  essayQuestions?: string[];         // ← 추가 권장 (자소서 문항)
  charLimit?: string;                // ← 추가 권장 (글자수 제한)
  isFavorite?: boolean;
  rating?: string | null;
  ratingUpdatedAt?: string | null;
  disabled?: boolean;                // 종료공고 배치가 사이트에서 내려간(마감) 공고에 표시. 대시보드에서 흐리게·X만 노출, 백필·추천 제외.
  closedAt?: string;                 // 종료 감지 시각(ISO).
}

export interface GeneratedDocuments {
  coverLetter: string;
  intro: string;
  workExperience: string;
  coreCompetency?: string; // 핵심역량: 5초 스캔용 요약(최대 4줄, §6-1). 문서 작성 배치·단일 생성이 채운다.
  matchReport?: string; // 매칭률 사전 평가표 + 지원 권장도 (매칭률 조회 배치 또는 문서 작성 배치가 생성)
  generatedAt: string;
}

export interface HiddenJobPosting extends JobPosting {
  hiddenAt: string;
}

// 영구 삭제 공고 이력: 스크래핑 배치가 같은 공고(기업명+제목 일치)를 재수집하지 않도록 보관한다.
export interface PurgedJobHistoryEntry {
  company: string;
  title: string;
  purgedAt: string;
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
