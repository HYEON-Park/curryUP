import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getJobPostings } from "../data/store.js";
import { isCollectedToday, todayLocalKey } from "../utils/date.js";
import { runManualJob, type RunRecord } from "./runLog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

export const WRITE_DOCS_JOB_NAME = "write-documents";

// 문서생성 기준(.claude/skills/write-documents/SKILL.md와 동일):
//   1) 신규 트랙: 오늘 수집 + 평점 2.8 이상 (+ 매칭률 70% 이상 — 매칭률은 Claude가 평가표 작성 시 판단)
//   2) 즐겨찾기 트랙: isFavorite — 평점·매칭률 조건 없음
// collectedAt의 날짜 비교는 utils/date.ts의 로컬 날짜 기준을 공유한다(deleteTodaysJobPostings와 동일).
const MIN_RATING = 2.8;

// "이미 처리됨" 판정은 documents 객체 존재가 아니라 자소서(coverLetter) 작성 여부로 한다.
// 매칭률 조회 배치가 documents.matchReport만 먼저 채워 documents가 생겼더라도, coverLetter가 비어 있으면
// 아직 자소서 미작성이므로 문서 작성 대상에 포함해야 한다(그래야 매칭률만 있는 공고도 자소서를 받는다).
function hasCoverLetter(j: { documents: { coverLetter?: string } | null }): boolean {
  return Boolean(j.documents?.coverLetter);
}

async function countTargets(): Promise<number> {
  const jobs = await getJobPostings();
  return jobs.filter((j) => {
    if (hasCoverLetter(j)) return false;
    if (j.isFavorite === true) return true;
    const rating = j.rating ? parseFloat(j.rating) : NaN;
    return isCollectedToday(j.collectedAt) && rating >= MIN_RATING;
  }).length;
}

// Claude Code CLI를 headless로 실행해 write-documents 스킬 절차대로 문서를 작성하게 한다.
// 프롬프트는 셸 이스케이프 문제를 피하기 위해 stdin으로 전달한다.
// todayKey는 서버가 계산한 로컬 날짜다. collectedAt은 UTC ISO라 앞 10자를 그대로 비교하면
// 로컬 00:00~09:00 수집분이 전날로 밀리므로, 판정 기준을 프롬프트에 명시해 넘긴다.
function runClaudeWriteDocuments(todayKey: string): Promise<void> {
  const prompt = [
    "write-documents 문서 작성 배치를 실행해줘.",
    ".claude/skills/write-documents/SKILL.md의 프롬프트 체계와 실행 절차를 그대로 따라.",
    "문서생성 기준(SKILL.md와 동일): 아직 자소서가 없는 공고(documents가 null이거나, documents는 있어도 coverLetter가 빈 문자열/없음) 중",
    `(1) 오늘 수집(collectedAt을 로컬 시간대로 변환한 날짜가 ${todayKey}) + 평점 2.8 이상 + 매칭률 사전 평가 70% 이상인 공고 — 70% 미만이면 작성 생략하고 사유 보고,`,
    "(2) 즐겨찾기(isFavorite) 공고 — 조건 없이 작성.",
    "이미 documents.matchReport가 있으면(매칭률 조회 배치가 먼저 작성한 것) 그 매칭률을 재사용해 70% 판정에 쓰고 matchReport는 다시 만들지 마. coverLetter·intro·workExperience만 새로 채워 병합해.",
    "documents.matchReport가 없으면 매칭률 평가표부터 새로 작성해 함께 저장해.",
    "연차 필터(프로필 ±2 초과 제외·삭제 후보 보고) 등 나머지 규칙도 SKILL.md대로 적용해.",
    "개인 정보(연차·슬로건·서사·학력 등)는 하드코딩하지 말고 userProfile.json에서 로드해(SKILL §8 필드 매핑). 비어 있는 필드는 건너뛰어.",
    "Bash 도구는 사용하지 말고 Read/Edit/Write 도구만으로 jobPostings.json을 수정해.",
    "서버 재시작·git 작업은 하지 마. 완료 후 작성/생략 건수와 회사 목록을 보고해.",
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
export async function runWriteDocumentsIfNeeded(): Promise<RunRecord | null> {
  const targetCount = await countTargets();
  if (targetCount === 0) {
    console.log("[writeDocumentsJob] 작성 대상 없음 — 건너뜀");
    return null;
  }
  console.log(`[writeDocumentsJob] 작성 대상 ${targetCount}건 — Claude 문서 작성 배치 시작`);
  const todayKey = todayLocalKey();
  return runManualJob(WRITE_DOCS_JOB_NAME, () => runClaudeWriteDocuments(todayKey));
}
