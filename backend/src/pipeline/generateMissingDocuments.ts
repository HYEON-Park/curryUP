import { generateDocumentsForPosting } from "../ai/generateDocuments.js";
import { getJobPostings, getProfile, saveJobPostings } from "../data/store.js";

export interface GenerateProgress {
  total: number;
  completed: number;
  currentTitle: string | null;
}

export async function generateMissingDocuments(
  onProgress?: (progress: GenerateProgress) => void
): Promise<{ generated: number; failed: number }> {
  const profile = await getProfile();
  const jobs = await getJobPostings();
  const pending = jobs.filter((job) => !job.documents);
  let generated = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i++) {
    const job = pending[i];
    onProgress?.({ total: pending.length, completed: i, currentTitle: `${job.company} - ${job.title}` });
    try {
      job.documents = await generateDocumentsForPosting(profile, job);
      generated++;
    } catch (error) {
      console.error(`Failed to generate documents for ${job.id} (${job.title}):`, error);
      failed++;
    }
    // 건당 4~5분 걸리는 작업이라, 중간에 프로세스가 죽어도 그동안 만든 문서는 남도록 매 건마다 저장한다.
    await saveJobPostings(jobs);
  }
  onProgress?.({ total: pending.length, completed: pending.length, currentTitle: null });

  return { generated, failed };
}
