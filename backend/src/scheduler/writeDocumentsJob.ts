import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cron from "node-cron";
import { getBatchUserIds, getJobPostings, hasProfile } from "../data/store.js";
import type { JobPosting } from "../types.js";
import { getRecommendations } from "../utils/recommendations.js";
import { runManualJob, type RunRecord } from "./runLog.js";
import { withScheduledRetry } from "./scheduledRetry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

export const WRITE_DOCS_JOB_NAME = "write-documents";

const SCHEDULED_HOUR = 21;
const SCHEDULED_MINUTE = 0;

// "이미 처리됨" 판정은 documents 객체 존재가 아니라 자소서(coverLetter) 작성 여부로 한다.
// 매칭률 조회 배치가 documents.matchReport만 먼저 채워 documents가 생겼더라도, coverLetter가 비어 있으면
// 아직 자소서 미작성이므로 문서 작성 대상에 포함해야 한다(그래야 매칭률만 있는 공고도 자소서를 받는다).
function hasCoverLetter(j: { documents: { coverLetter?: string } | null }): boolean {
  return Boolean(j.documents?.coverLetter);
}

// 문서작성 대상 = 오늘의 추천공고(getRecommendations) ∪ 즐겨찾기.
// 대상 판정은 추천공고 판정 함수 한 곳(utils/recommendations)만 재사용한다 — 예전처럼 평점 문턱을
// 여기서 다시 계산하지 않는다. 그래야 "추천에 뜬 공고 = 문서작성 대상"이 항상 일치한다(규칙 이원화 방지).
//   - 추천 트랙: 오늘 수집 + 미종료 + 매칭률 70% 이상 + 평점 2.8 이상(또는 평점 미확인) — 추천공고와 동일.
//   - 즐겨찾기 트랙: isFavorite(미종료) — 평점·매칭률 조건 없음.
// 이미 자소서(coverLetter)가 있는 공고는 제외한다.
async function collectDocTargets(userId: string): Promise<JobPosting[]> {
  const { items } = await getRecommendations(userId); // 오늘의 추천공고(단일 기준)
  const jobs = await getJobPostings(userId);
  const favorites = jobs.filter((j) => j.isFavorite === true && !j.disabled);
  const byId = new Map<string, JobPosting>();
  for (const j of [...items, ...favorites]) byId.set(j.id, j);
  return [...byId.values()].filter((j) => !hasCoverLetter(j));
}

// Claude Code CLI를 headless로 실행해 write-documents 스킬 절차대로 문서를 작성하게 한다.
// 프롬프트는 셸 이스케이프 문제를 피하기 위해 stdin으로 전달한다.
// 대상은 서버가 "오늘의 추천공고 ∪ 즐겨찾기"로 이미 확정해 id 목록으로 넘긴다(matchCheckJob과 동일 방식).
// Claude는 평점·매칭률·연차로 대상을 다시 거르지 말고 지정된 id의 공고만 전부 작성한다
// (그래야 추천공고 판정과 문서작성 대상이 항상 일치한다 — 규칙 이원화로 인한 누락 방지).
function runClaudeWriteDocuments(userId: string, targets: JobPosting[]): Promise<void> {
  const jobsFile = `backend/src/data/jobPostings/${userId}.json`;
  const profileFile = `backend/src/data/profiles/${userId}.json`;
  const targetList = targets.map((j) => `  - id=${j.id} | ${j.company} | ${j.title}`).join("\n");
  const prompt = [
    "write-documents 문서 작성 배치를 실행해줘.",
    ".claude/skills/write-documents/SKILL.md의 프롬프트 체계와 실행 절차(§6-1~§6-6)를 그대로 따라.",
    `대상: ${jobsFile}에서 아래 id 목록의 공고 ${targets.length}건만 처리해(서버가 오늘의 추천공고·즐겨찾기로 이미 확정한 대상).`,
    "이 목록에 없는 공고는 절대 읽거나 수정하지 마. 목록의 공고는 평점·매칭률·연차로 다시 거르지 말고 전부 작성해(대상 판정은 서버가 끝냈다).",
    targetList,
    "이미 documents.matchReport가 있으면(매칭률 조회 배치가 먼저 작성한 것) 그 매칭률을 재사용하고 matchReport는 다시 만들지 마. coreCompetency·coverLetter·intro·workExperience만 새로 채워 병합해.",
    "documents.matchReport가 없으면(즐겨찾기 등) 매칭률 평가표부터 새로 작성해 함께 저장해.",
    "핵심역량(coreCompetency, §6-1)·경력사항(workExperience, §6-2)·자기소개서(coverLetter, §6-3~§6-5)를 모두 작성하고, 마지막에 §6-6 문서 간 일관성 검증으로 4종을 대조해.",
    `개인 정보(연차·슬로건·서사·학력 등)는 하드코딩하지 말고 ${profileFile}에서 로드해(SKILL §8 필드 매핑). 비어 있는 필드는 건너뛰어.`,
    `다듬은 자소서 등 산출물을 파일로 저장할 때는 backend/src/data/polished/${userId}/ 아래에 저장해.`,
    `Bash 도구는 사용하지 말고 Read/Edit/Write 도구만으로 ${jobsFile}을 수정해.`,
    "저장 직전에 파일을 다시 읽어 id 기준으로 병합할 것(서버가 파일을 동시에 쓸 수 있음).",
    "서버 재시작·git 작업은 하지 마. 완료 후 작성 건수와 회사 목록을 보고해.",
  ].join("\n");

  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", "--permission-mode", "acceptEdits"], {
      cwd: REPO_ROOT,
      shell: true, // Windows에서 claude.cmd 해석을 위해 필요
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));

    child.on("error", reject);
    child.on("close", (code) => {
      // 결과 요약은 서버 로그로 남긴다 (관리자 페이지 이력은 runLog가 담당).
      console.log("[writeDocumentsJob] claude 결과:", stdout.slice(-2000));
      if (code === 0) resolve();
      else reject(new Error(`claude CLI 종료 코드 ${code}: ${stderr.slice(-500)}`));
    });

    child.stdin.write(prompt, "utf-8");
    child.stdin.end();
  });
}

// scrape → ratingCheck 이후 무조건 호출된다. 작성 대상이 있으면 반드시 실행하고,
// 대상이 없으면 실행 이력을 남기지 않고 건너뛴다.
export async function runWriteDocumentsIfNeeded(userId: string): Promise<RunRecord | null> {
  // 프로필이 없으면 매칭 기준이 없어 문서를 작성할 수 없다(collect 체인·스케줄 공통 진입점).
  if (!(await hasProfile(userId))) {
    console.log("[writeDocumentsJob] 프로필 미작성 — 문서 작성 배치 건너뜀");
    return null;
  }
  const targets = await collectDocTargets(userId);
  if (targets.length === 0) {
    console.log("[writeDocumentsJob] 작성 대상 없음(오늘의 추천공고·즐겨찾기 없음 또는 이미 작성) — 건너뜀");
    return null;
  }
  console.log(`[writeDocumentsJob] 작성 대상 ${targets.length}건 — Claude 문서 작성 배치 시작`);
  return runManualJob(userId, WRITE_DOCS_JOB_NAME, () => runClaudeWriteDocuments(userId, targets));
}

// 매일 08:00, 스크래핑 배치(07:00)가 수집·평점·매칭률까지 마친 당일 공고에 대해 Claude 문서 작성
// 배치를 실행한다. 대상은 관리자가 등록한 유저 전부(getBatchUserIds). 사용자별 순차. 대상이 없으면 건너뛴다.
export function startWriteDocumentsJob(): void {
  cron.schedule(`${SCHEDULED_MINUTE} ${SCHEDULED_HOUR} * * *`, async () => {
    const userIds = await getBatchUserIds();
    if (userIds.length === 0) {
      console.log("[writeDocumentsJob] 배치 대상 유저 없음 — 문서 작성 스케줄 건너뜀");
      return;
    }
    // 실패 시 5분 뒤 1회 재시도 + 더블 실패 OS 알림. 대상 없음(스킵)은 재시도하지 않는다.
    for (const userId of userIds) {
      await withScheduledRetry(WRITE_DOCS_JOB_NAME, () => runWriteDocumentsIfNeeded(userId));
    }
  });
}
