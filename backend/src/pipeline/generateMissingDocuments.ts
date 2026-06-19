import { generateDocumentsForPosting } from "../ai/generateDocuments.js";
import { getJobPostings, getProfile, saveJobPostings } from "../data/store.js";

export async function generateMissingDocuments(): Promise<{ generated: number; failed: number }> {
  const profile = await getProfile();
  const jobs = await getJobPostings();
  let generated = 0;
  let failed = 0;

  for (const job of jobs) {
    if (job.documents) continue;
    try {
      job.documents = await generateDocumentsForPosting(profile, job);
      generated++;
    } catch (error) {
      console.error(`Failed to generate documents for ${job.id} (${job.title}):`, error);
      failed++;
    }
  }

  await saveJobPostings(jobs);
  return { generated, failed };
}
