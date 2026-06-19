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

  const [coverLetter, intro, workExperience] = await Promise.all([
    generateCoverLetter(profile, posting, companyResearch),
    generateIntro(profile, posting, companyResearch),
    generateWorkExperience(profile, posting),
  ]);

  return { coverLetter, intro, workExperience, generatedAt: new Date().toISOString() };
}
