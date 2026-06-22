import cron from "node-cron";
import { notifyWithLink } from "../notify/osNotifier.js";
import { generateMissingDocuments } from "../pipeline/generateMissingDocuments.js";
import { catchUpIfMissed, runDailyJob, updateProgress } from "./runLog.js";

const SCHEDULED_HOUR = 23;
const SCHEDULED_MINUTE = 0;
const PORT = process.env.PORT || 4000;
const JOB_NAME = "aiBatch";

async function aiBatchTask(): Promise<void> {
  const result = await generateMissingDocuments((progress) => {
    updateProgress(JOB_NAME, progress).catch((error) =>
      console.error("[aiBatchJob] progress update failed:", error)
    );
  });
  console.log("[aiBatchJob] document generation:", result);

  if (result.generated > 0) {
    notifyWithLink({
      title: "새 커리어 문서 생성 완료",
      message: `New 커리가 만들어졌다...🍛🍛🍛 (${result.generated}건)`,
      url: `http://localhost:${PORT}/`,
    });
  }
}

// 매일 23:00, 그날 수집되어 documents가 null인 채로 쌓인 공고를 일괄 생성한다.
export function startAiBatchJob(): void {
  cron.schedule(`${SCHEDULED_MINUTE} ${SCHEDULED_HOUR} * * *`, () => runDailyJob(JOB_NAME, aiBatchTask));
}

// 백엔드가 23:00 이후에 켜졌고 당일 배치 처리 기록이 없다면 즉시 따라잡는다.
export function catchUpAiBatchJob(): Promise<void> {
  return catchUpIfMissed(JOB_NAME, SCHEDULED_HOUR, SCHEDULED_MINUTE, aiBatchTask);
}

// 스케줄과 무관하게 지금 바로 실행한다 (오늘자 실행 기록도 함께 남겨 23:00 중복 실행을 막는다).
export function runAiBatchNow(): Promise<void> {
  return runDailyJob(JOB_NAME, aiBatchTask);
}
