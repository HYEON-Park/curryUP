import type { JobPosting, UserProfile } from "../types.js";
import { generateClean } from "./ensureClean.js";
import { buildPersonaSystemPrompt } from "./persona.js";

export async function generateCoverLetter(
  profile: UserProfile,
  posting: JobPosting,
  companyResearch: string
): Promise<string> {
  return generateClean(
    buildPersonaSystemPrompt(profile.yearsOfExperience),
    `아래 정보로 "${posting.company}"의 "${posting.title}" 공고에 지원할 자기소개서를 작성해줘.

다음 6단계 과정을 내부적으로 거쳐 최종본만 출력해:
1. 외부 데이터 조사 결과 반영 (아래 제공)
2. 공고의 핵심 요구 역량과 지원자 경험 매칭
3. 글쓰기 전략 채택 — 지원동기 문항은 KKK 전략(산업→회사→나 순서로 전개), 직무역량/문제해결 문항은 STAR-F 전략 활용
4. 초안 작성
5. 자가 검증 (논리/누락 체크)
6. 최종본 도출

[지원 회사 리서치]
${companyResearch}

[공고 정보]
직무: ${posting.title}
요구 기술: ${posting.skills.join(", ")}
근무지: ${posting.location}

[지원자 프로필]
경력: ${profile.yearsOfExperience ?? "신입"}년차
기술 스택: ${profile.skills.join(", ")}
경력 사항: ${profile.careerHistory}
직무 관련 추가 정보: ${Object.entries(profile.roleAnswers)
      .map(([q, a]) => `${q} ${a}`)
      .join(" / ")}

최종 자기소개서 본문만 출력하고, 설명이나 머리말은 붙이지 마.`
  );
}
