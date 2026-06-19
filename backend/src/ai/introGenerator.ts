import type { JobPosting, UserProfile } from "../types.js";
import { generateClean } from "./ensureClean.js";
import { buildPersonaSystemPrompt } from "./persona.js";

export async function generateIntro(
  profile: UserProfile,
  posting: JobPosting,
  companyResearch: string
): Promise<string> {
  return generateClean(
    buildPersonaSystemPrompt(profile.yearsOfExperience),
    `"${posting.company}"의 "${posting.title}" 공고를 보는 인사담당자를 위한 짧은 소개글을 PAS 구조(Problem-Agitation-Solution)로 작성해줘.

- 첫 두 줄에 인사담당자의 시선을 끄는 강력한 훅을 배치
- 전체 2,000자 미만
- 마지막 줄은 명확한 CTA(예: "면접에서 자세히 말씀드리고 싶습니다", "연락 주시면 바로 답변드리겠습니다")로 마무리

[지원 회사 리서치]
${companyResearch}

[지원자 프로필]
경력: ${profile.yearsOfExperience ?? "신입"}년차
기술 스택: ${profile.skills.join(", ")}
경력 사항: ${profile.careerHistory}

소개글 본문만 출력하고, 설명이나 머리말은 붙이지 마.`
  );
}
