import { Router } from "express";
import { authMiddleware } from "../auth/jwt.js";
import { sendUpdateCompleteEmail } from "../auth/mailer.js";
import { hasProfile } from "../data/store.js";
import { runScrapeAndMatch } from "../pipeline/runScrapeAndMatch.js";
import { runMatchCheckIfNeeded } from "../scheduler/matchCheckJob.js";
import { runRatingCheckNow } from "../scheduler/ratingCheckJob.js";
import { runManualJob } from "../scheduler/runLog.js";
import { getRecommendations } from "../utils/recommendations.js";

export const collectRouter = Router();
collectRouter.use(authMiddleware);
const JOB_NAME = "collect";

// 문서 생성은 별도 문서 작성 배치가 담당한다. 여기서 동시에 트리거하면 배치와 동시에
// jobPostings.json을 써서 데이터가 덮어써질 수 있어 분리해둔다.
collectRouter.post("/", async (req, res) => {
  const userId = req.user!.userId;
  // 프로필이 없으면 매칭 기준이 없어 수집·매칭률·문서 작성을 돌릴 수 없다(프런트도 동일 가드).
  if (!(await hasProfile(userId))) {
    res.status(400).json({ error: "NO_PROFILE" });
    return;
  }
  let result: Awaited<ReturnType<typeof runScrapeAndMatch>> | undefined;
  const record = await runManualJob(userId, JOB_NAME, async () => {
    result = await runScrapeAndMatch(userId);
  });
  if (record.status === "failed") {
    console.error("[manual collect] failed:", record.error);
    res.status(500).json({ error: "수집 중 오류가 발생했습니다." });
    return;
  }

  // 수집이 끝나면 매칭률 조회 → 평점 조회를 백엔드에서 순서대로 이어서 실행한다.
  // (배치 순서 변경: 매칭률을 먼저 산정하고, 매칭률 60% 이상 공고의 회사만 평점 조회한다.)
  // 수집 완료 시점에 서버가 직접 시작해 브라우저 상태(탭 이동·종료)와 무관하게 항상 실행되도록 보장한다.
  // 두 배치 모두 수 분 걸릴 수 있어 응답은 기다리지 않고 시작만 시킨다
  // (프런트는 match-check/status → rating-check/status 순으로 완료를 폴링한다).
  runMatchCheckIfNeeded(userId)
    .then(() => runRatingCheckNow(userId))
    // 매칭률·평점 조회까지 끝나면(=UPDATE 완료) 해당 사용자 이메일로 완료 알림 메일을 보낸다.
    // 오늘의 추천 공고(매칭률 70% 이상)가 있으면 메일에 함께 싣는다.
    .then(async () => {
      const { items } = await getRecommendations(userId);
      await sendUpdateCompleteEmail(
        req.user!.email,
        { collected: result?.collected ?? 0, newlyMatched: result?.newlyMatched ?? 0 },
        items,
      );
    })
    .catch((error) => console.error("[manual collect] match/rating/mail failed:", error));

  res.json(result);
});
