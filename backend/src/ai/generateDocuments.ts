import type { GeneratedDocuments, JobPosting, UserProfile } from "../types.js";
import { researchCompany } from "./companyResearch.js";
import { generateCoverLetter } from "./coverLetterGenerator.js";
import { generateIntro } from "./introGenerator.js";
import { generateWorkExperience } from "./workExperienceGenerator.js";

export async function generateDocumentsForPosting(
  profile: UserProfile,
  posting: JobPosting
): Promise<GeneratedDocuments> {
  const companyResearch = await researchCompany(posting.company);

  // CPU-only 로컬 추론이라 동시에 여러 요청을 돌리면 자원 경합으로 응답이
  // 급격히 느려져 타임아웃이 잦다. 순차 실행으로 안정성을 우선한다.
  const coverLetter = await generateCoverLetter(profile, posting, companyResearch);
  const intro = await generateIntro(profile, posting, companyResearch);
  const workExperience = await generateWorkExperience(profile, posting);

  return { coverLetter, intro, workExperience, generatedAt: new Date().toISOString() };
}
