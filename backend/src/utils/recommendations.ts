import { getJobPostings } from "../data/store.js";
import { getLatestRun, type RunRecord } from "../scheduler/runLog.js";
import type { JobPosting } from "../types.js";
import { localDateKey } from "./date.js";
import { daysUntilDeadline } from "./deadline.js";
import { matchOverallPercent } from "./matchReport.js";

// 추천 공고 문턱: 종합 매칭률 이 값 이상이면 추천 대상(대시보드 카드 강조·추천 팝업·UPDATE 완료 메일 공통).
export const RECOMMEND_MIN_PERCENT = 70;

// 추천 공고 평점 문턱: 잡플래닛 평점(회사 평점)이 이 값 이상인 공고만 추천한다.
// 평점 조회 배치는 매칭률 조회 이후 실행되므로 추천 판정 시점엔 rating이 채워져 있다.
// 평점이 없는(null·조회 실패) 공고는 문턱을 판단할 수 없어 추천에 포함한다(평점 미확인으로 배제하지 않음).
export const RECOMMEND_MIN_RATING = 2.8;

// rating은 "3.6"·"2.9" 같은 문자열(잡플래닛 텍스트) 또는 null. 숫자로 파싱하고, 파싱 불가면 null.
export function parseRating(rating: string | null | undefined): number | null {
  if (rating == null) return null;
  const n = Number.parseFloat(rating);
  return Number.isNaN(n) ? null : n;
}

// 대시보드 카드 강조 조건과 동일(프런트 isHighlighted): 즐겨찾기이거나 매칭률 종합 70% 이상.
// 매칭률은 documents.matchReport 한 곳에만 쌓인다(매칭률 조회 배치·문서 작성 배치 공통).
// 상단 고정 우선순위: 즐겨찾기(0) > 매칭률 70%+(1) > 일반(2). 낮을수록 위로.
export function priorityRank(job: JobPosting): number {
  if (job.isFavorite === true) return 0;
  const overall = matchOverallPercent(job.documents?.matchReport);
  if (overall !== null && overall >= RECOMMEND_MIN_PERCENT) return 1;
  return 2;
}

// 먼저 우선순위 티어(즐겨찾기 → 매칭률 70%+ → 일반)로 올리고, 같은 티어 안에서는 기존 기준을 적용한다:
// D-day가 긴(남은 일수가 많은) 순, 같으면 기업명 가나다순, 마감일이 없는 공고는 맨 뒤(그 안에서 가나다순).
export function compareJobs(a: JobPosting, b: JobPosting): number {
  const rankDiff = priorityRank(a) - priorityRank(b);
  if (rankDiff !== 0) return rankDiff;

  const aDays = daysUntilDeadline(a.deadline);
  const bDays = daysUntilDeadline(b.deadline);

  if (aDays === null && bDays === null) return a.company.localeCompare(b.company, "ko");
  if (aDays === null) return 1;
  if (bDays === null) return -1;
  if (aDays !== bDays) return bDays - aDays;
  return a.company.localeCompare(b.company, "ko");
}

// 추천 공고 판정 규칙(단일 함수). 추천 팝업 라우트(routes/jobs.ts)와 UPDATE 완료 메일(auth/mailer.ts)이
// 이 함수를 공유한다 — 판정 규칙을 프런트/백엔드 여러 곳에 복제하지 않는다(CLAUDE.md).
//
// 세션 식별: 수집 파이프라인(수동 collect·스케줄 scrape)의 가장 최근 실행. 둘 다 같은 산출(매칭표)을 낸다.
// 추천 항목: 그 세션이 수집한 날짜의 공고 중 미종료·종합 매칭률 70% 이상·회사 평점 2.8 이상.
export async function getRecommendations(
  userId: string,
): Promise<{ sessionId: string | null; items: JobPosting[] }> {
  const pipelineRuns = (
    await Promise.all([getLatestRun(userId, "collect"), getLatestRun(userId, "scrape")])
  ).filter((r): r is RunRecord => r !== null);
  const sessionRun = pipelineRuns.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null;
  const sessionId = sessionRun ? sessionRun.id : null;

  const jobs = await getJobPostings(userId);
  const items = sessionRun
    ? jobs
        .filter((j) => localDateKey(j.collectedAt) === sessionRun.date)
        .filter((j) => !j.disabled) // 종료 공고는 추천에서 제외.
        .filter((j) => {
          const overall = matchOverallPercent(j.documents?.matchReport);
          return overall !== null && overall >= RECOMMEND_MIN_PERCENT;
        })
        .filter((j) => {
          // 회사 평점 2.8 이상이거나, 평점이 없는(null·조회 실패) 공고는 추천에 포함한다.
          const rating = parseRating(j.rating);
          return rating === null || rating >= RECOMMEND_MIN_RATING;
        })
        .sort(compareJobs)
    : [];

  return { sessionId, items };
}
