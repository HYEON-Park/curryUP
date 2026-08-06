import { notifyWithLink } from "../notify/osNotifier.js";
import type { RunRecord } from "./runLog.js";

// 스케줄 배치 실패 시 재시도까지의 대기 시간(5분).
const RETRY_DELAY_MS = 5 * 60 * 1000;
const PORT = process.env.PORT || 4000;

// 더블 실패 OS 알림에 쓸 사용자용 배치 이름(jobName → 표시명).
const JOB_LABELS: Record<string, string> = {
  scrape: "공고 수집",
  notify: "프로필 알림",
  "write-documents": "문서 작성",
  종료공고: "종료 공고 점검",
};

// 원본·재시도가 모두 실패했을 때 OS 알림으로 통지한다.
// notify 배치가 쓰는 osNotifier(notifyWithLink)를 그대로 재사용하고 문구만 실패용으로 바꾼다.
function notifyDoubleFailure(jobName: string): void {
  const label = JOB_LABELS[jobName] ?? jobName;
  notifyWithLink({
    title: "배치 실패 알림",
    message: `${label} 배치가 재시도까지 실패했습니다. 대시보드에서 확인해주세요.`,
    url: `http://localhost:${PORT}/`,
  });
}

// 스케줄 배치 공통 재시도 래퍼.
// run()으로 배치를 실행하고, 결과 RunRecord의 status가 "failed"이면 5분 뒤 run()을 1회 더 실행한다.
// 재시도까지 실패(더블 실패)하면 OS 알림으로 통지한다.
// - run()이 null을 반환하면(대상 없음 등 정상 스킵) 재시도하지 않는다.
// - 반환값은 원본(1차) 실행 결과 — 기존 동작과 동일하게 즉시 반환되고, 재시도는 백그라운드로 진행된다.
// - setTimeout 기반이라 재시도 대기 중 서버가 재시작되면 그 재시도는 유실된다(반복 재현 시 별도 대응).
export async function withScheduledRetry(
  jobName: string,
  run: () => Promise<RunRecord | null>
): Promise<RunRecord | null> {
  const first = await run();
  if (!first || first.status !== "failed") return first;

  console.warn(`[retry] ${jobName} 1차 실패 — ${RETRY_DELAY_MS / 60000}분 후 재시도 예약`);
  setTimeout(() => {
    void (async () => {
      try {
        const retry = await run();
        if (retry && retry.status === "failed") {
          console.error(`[retry] ${jobName} 재시도까지 실패(더블 실패) — OS 알림 발송`);
          notifyDoubleFailure(jobName);
        } else {
          console.log(`[retry] ${jobName} 재시도 성공`);
        }
      } catch (error) {
        console.error(`[retry] ${jobName} 재시도 실행 중 예외:`, error);
        notifyDoubleFailure(jobName);
      }
    })();
  }, RETRY_DELAY_MS);

  return first;
}
