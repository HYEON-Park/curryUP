import type { JobPosting, UserProfile } from "../types.js";
import { generateClean } from "./ensureClean.js";
import { buildPersonaSystemPrompt } from "./persona.js";

export async function generateWorkExperience(
  profile: UserProfile,
  posting: JobPosting
): Promise<string> {
  return generateClean(
    buildPersonaSystemPrompt(profile.yearsOfExperience),
    `지원자의 경력 사항을 "${posting.company}"의 "${posting.title}" 공고에 맞춰 재작성해줘.

[재작성 원칙]

1. 키워드 매칭
- 공고 요구 기술 ${posting.skills.join(", ")} 중 지원자가 보유한 기술은 본문 상단·기술 스택 라인에서 가장 앞으로 배치
- 공고 담당업무에 등장한 표현(예: "데이터 송수신", "RESTful API 연동", "DB 최적화")을 가능하면 그대로 인용
- 보유하지 않은 기술은 임의 추가 금지

2. 우선순위 재배치
- 각 프로젝트의 업무 성과 항목 순서를 공고 요구사항과의 관련성 높은 순으로 재정렬
- 공고와 무관한 성과는 후순위 배치 또는 1줄로 축약

3. 핵심 역량 섹션 추가
- 경력 기술 상단에 "[ 핵심 역량 ]" 섹션 생성
- 공고 요구사항과 매칭되는 보유 역량 4~6개를 불릿으로 정리
- 각 불릿은 "역량명 — 구체 경험 또는 산출물" 형식

4. 개인 프로젝트·학습 섹션 (조건부)
- 공고에 명시된 기술 중 본 경력에 없는 항목이 있다면, 개인 프로젝트·학습 섹션을 별도로 추가
- 갭을 메우려는 능동적 학습 활동이 있다면 명시

[출력 구조]
[ 핵심 역량 ]
- (불릿 4~6개)

[ 담당 업무 ]
- (불릿 3~5개, 공고 표현 우선 사용)

[ 경력 기술 ]
### 1) 프로젝트명
- 연계/소속회사:
- 수행 기간:
- 기술 스택: (공고 요구 기술 우선 배치, 굵게 강조)
- 프로젝트 성격: (한 줄)
- 업무 성과: (공고 관련성 높은 순서로 재정렬)

[ 개인 프로젝트 / 학습 ]  ← 갭 보완용, 해당 시에만
- (학습 중인 기술, 진행 중인 사이드 프로젝트)

[금지 사항]
- 보유하지 않은 기술·프로젝트·자격증 창작
- 원문에 없는 수치 임의 생성 (단, 합리적 추정은 "약" 표기와 함께 허용)
- 추상적 형용사 ("탁월한", "유연한", "체계적인") 사용

[공고 요구 기술]
${posting.skills.join(", ")}

[공고 담당업무]
${posting.responsibilities ?? "공고 본문 참조"}

[지원자 경력 사항 원문]
${profile.careerHistory}

[지원자 추가 정보]
- 진행 중인 개인 프로젝트: ${profile.sideProjects ?? "없음"}
- 학습 중인 기술: ${profile.learningStack ?? "없음"}
- AI 도구 활용 경험: ${profile.aiToolUsage ?? "없음"}

재작성된 경력사항 본문만 출력하고, 설명이나 머리말은 붙이지 마.`
  );
}
