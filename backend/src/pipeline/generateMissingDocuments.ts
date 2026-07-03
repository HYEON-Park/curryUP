import { generateDocumentsForPosting } from "../ai/generateDocuments.js";
import { getImminentThresholdDays } from "../config/skillFileParser.js";
import { getJobPostings, getProfile, saveJobPostings } from "../data/store.js";
import { daysUntilDeadline } from "../utils/deadline.js";

export interface GenerateProgress {
  total: number;
  completed: number;
  currentTitle: string | null;
}

// SKILL.md 기준 AI 프롬프트 생성 대상: 대시보드 게시(=getJobPostings, 삭제 공고는 이미 hiddenJobPostings로
// 분리되어 있음) + 마감 임박(D-0~N) 제외 + 마감일 정보 누락 제외 + 문서 미생성 공고만 대상으로 한다.
// 마감 임박 공고에 문서를 만들어봐야 대시보드/기동 시 자동삭제 로직에 의해 곧바로 사라지기 때문이다.
export async function generateMissingDocuments(
  onProgress?: (progress: GenerateProgress) => void
): Promise<{ generated: number; failed: number }> {
  const profile = await getProfile();
  const jobs = await getJobPostings();
  const thresholdDays = await getImminentThresholdDays();
  const startedAt = new Date().toISOString();

  const noDeadline = jobs.filter((job) => daysUntilDeadline(job.deadline) === null);
  if (noDeadline.length > 0) {
    console.warn(
      `[generateMissingDocuments] 마감일 정보 누락 공고 ${noDeadline.length}건 생성 대상에서 제외`
    );
  }

  const afterImminentFilter = jobs.filter((job) => {
    const days = daysUntilDeadline(job.deadline);
    return days !== null && days > thresholdDays;
  });
  const afterDeletedFilter = afterImminentFilter; // getJobPostings()는 이미 삭제(hidden) 공고를 제외한 목록
  const pending = afterDeletedFilter.filter((job) => !job.documents);

  console.log(
    `[generateMissingDocuments] ${startedAt} 전체 ${jobs.length}건 / 마감임박(D-${thresholdDays}) 필터 후 ${afterImminentFilter.length}건 / 삭제 필터 후 ${afterDeletedFilter.length}건 / 문서 미생성 필터 후 ${pending.length}건`
  );

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
