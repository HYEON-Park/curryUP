// ROLE_CATEGORIES(frontend/src/types.ts)의 기존 라벨을 그대로 재사용하는 대분류 그룹 레이어.
// 카테고리 이름 자체는 바꾸지 않으므로 ROLE_QUESTIONS 키, matchEngine의 rootKeyword 매칭에 영향이 없다.
export const ROLE_CATEGORY_GROUPS: { name: string; categories: string[] }[] = [
  {
    name: "IT개발·데이터",
    categories: [
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
    ],
  },
  { name: "디자인", categories: ["UX/UI 디자인", "그래픽/브랜드 디자인"] },
  { name: "기획·전략", categories: ["기획/PM"] },
  { name: "마케팅", categories: ["마케팅"] },
  { name: "영업·고객지원", categories: ["영업/세일즈", "고객지원/CS"] },
  { name: "인사·총무", categories: ["인사/HR"] },
  { name: "재무·회계", categories: ["재무/회계"] },
  { name: "운영", categories: ["운영/오퍼레이션"] },
];

// 각 직무 카테고리와 연관도가 높은 핵심 기술/키워드. 직무 카테고리 3열 UI에서
// 선택된 카테고리에 맞춰 보여주고, 클릭 시 기술 스택 필드에 추가된다.
export const CATEGORY_SKILL_HINTS: Record<string, string[]> = {
  "백엔드 개발": ["Java", "Spring", "Node.js", "Python", "Django", "MySQL", "PostgreSQL", "Redis", "AWS", "Kafka"],
  "프론트엔드 개발": ["JavaScript", "TypeScript", "React", "Vue.js", "Next.js", "HTML/CSS", "Webpack", "Redux"],
  "풀스택 개발": ["React", "Node.js", "TypeScript", "Spring", "PostgreSQL", "AWS", "Docker", "GraphQL"],
  "모바일 개발": ["Swift", "Kotlin", "Java", "React Native", "Flutter", "Android SDK", "iOS SDK"],
  "데이터 엔지니어링": ["SQL", "Python", "Spark", "Airflow", "Kafka", "Hadoop", "BigQuery", "Snowflake"],
  "데이터 분석/사이언스": ["SQL", "Python", "R", "Pandas", "Tableau", "통계분석", "머신러닝", "Excel"],
  "AI/ML": ["Python", "PyTorch", "TensorFlow", "scikit-learn", "LLM", "MLOps", "NLP", "컴퓨터비전"],
  "DevOps/인프라": ["AWS", "Docker", "Kubernetes", "Terraform", "Jenkins", "Linux", "CI/CD", "모니터링"],
  "QA/테스트": ["Selenium", "Appium", "JUnit", "테스트자동화", "JIRA", "테스트케이스 설계"],
  "보안": ["침해대응", "취약점진단", "방화벽", "ISMS", "암호화", "네트워크보안", "SIEM"],
  "게임 개발": ["Unity", "Unreal Engine", "C++", "C#", "게임서버", "그래픽스"],
  "임베디드/하드웨어": ["C", "C++", "MCU", "RTOS", "회로설계", "펌웨어", "PCB"],
  "UX/UI 디자인": ["Figma", "Sketch", "Adobe XD", "프로토타이핑", "사용성테스트", "디자인시스템"],
  "그래픽/브랜드 디자인": ["Photoshop", "Illustrator", "InDesign", "브랜딩", "타이포그래피"],
  "기획/PM": ["기획서작성", "백로그관리", "JIRA", "Notion", "데이터분석", "프로젝트관리"],
  "마케팅": ["퍼포먼스마케팅", "SNS마케팅", "콘텐츠마케팅", "GA", "SEO", "광고운영"],
  "영업/세일즈": ["B2B영업", "B2C영업", "거래처관리", "영업전략", "협상"],
  "고객지원/CS": ["고객응대", "CRM", "VOC관리", "콜센터", "채팅상담"],
  "인사/HR": ["채용", "HRD", "HRM", "인사평가", "조직문화", "노무관리"],
  "재무/회계": ["회계", "세무", "재무기획", "ERP", "IFRS", "원가관리"],
  "운영/오퍼레이션": ["프로세스개선", "SCM", "물류관리", "품질관리", "운영기획"],
};
