import { Router } from "express";
import { hasProfile } from "../data/store.js";
import { runScrapeAndMatch } from "../pipeline/runScrapeAndMatch.js";
import { runMatchCheckIfNeeded } from "../scheduler/matchCheckJob.js";
import { runRatingCheckNow } from "../scheduler/ratingCheckJob.js";
import { runManualJob } from "../scheduler/runLog.js";

export const collectRouter = Router();
const JOB_NAME = "collect";

// 문서 생성은 별도 문서 작성 배치가 담당한다. 여기서 동시에 트리거하면 배치와 동시에
// jobPostings.json을 써서 데이터가 덮어써질 수 있어 분리해둔다.
collectRouter.post("/", async (_req, res) => {
  // 프로필이 없으면 매칭 기준이 없어 수집·매칭률·문서 작성을 돌릴 수 없다(프런트도 동일 가드).
  if (!(await hasProfile())) {
    res.status(400).json({ error: "NO_PROFILE" });
    return;
  }
  let result: Awaited<ReturnType<typeof runScrapeAndMatch>> | undefined;
  const record = await runManualJob(JOB_NAME, async () => {
    result = await runScrapeAndMatch();
  });
  if (record.status === "failed") {
    console.error("[manual collect] failed:", record.error);
    res.status(500).json({ error: "수집 중 오류가 발생했습니다." });
    return;
  }

  // 수집이 끝나면 평점 조회 → 매칭률 조회를 백엔드에서 순서대로 이어서 실행한다.
  // 이전에는 프런트(UPDATE 버튼)가 수집 완료 후 평점 조회를 호출했는데, 수집 도중 탭을
  // 새로고침·이동·종료하면 그 후속 호출이 사라져 평점 조회가 누락됐다. 이제 수집 완료
  // 시점에 서버가 직접 시작해 브라우저 상태와 무관하게 항상 실행되도록 보장한다.
  // 평점 조회가 끝난 뒤(평점을 참고해) 당일 수집분의 매칭률 평가표를 마지막 단계로 작성한다.
  // 두 배치 모두 수 분 걸릴 수 있어 응답은 기다리지 않고 시작만 시킨다
  // (프런트는 rating-check/status → match-check/status 순으로 완료를 폴링한다).
  runRatingCheckNow()
    .then(() => runMatchCheckIfNeeded())
    .catch((error) => console.error("[manual collect] rating/match check failed:", error));

  res.json(result);
});
