import type { JobPosting, UserProfile } from "../types.js";
import { generateClean } from "./ensureClean.js";
import { buildPersonaSystemPrompt } from "./persona.js";

export async function generateWorkExperience(profile: UserProfile, posting: JobPosting): Promise<string> {
  return generateClean(
    buildPersonaSystemPrompt(profile.yearsOfExperience),
    `지원자의 경력 사항을 "${posting.company}"의 "${posting.title}" 공고에 맞춰 재작성해줘.

- 공고가 요구하는 사업 방향성과 직무 기술서에 맞추어 키워드를 재조정
- 공고에서 요구하는 주요 상세 업무와 관련성 높은 경험을 상단으로 올려 우선순위 재배치

[공고 요구 기술] ${posting.skills.join(", ")}

[지원자 경력 사항 원문]
${profile.careerHistory}

재작성된 경력사항 본문만 출력하고, 설명이나 머리말은 붙이지 마.`
  );
}
