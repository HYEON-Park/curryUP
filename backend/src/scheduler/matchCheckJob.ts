import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getJobPostings, hasProfile } from "../data/store.js";
import { isCollectedToday, todayLocalKey } from "../utils/date.js";
import { runManualJob, type RunRecord } from "./runLog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

export const MATCH_CHECK_JOB_NAME = "매칭률조회";

// 대상: 오늘 수집된 공고 중 아직 매칭률 평가표(documents.matchReport)가 없는 공고.
// 매칭률은 documents.matchReport 한 곳에만 쌓는다(문서 작성 배치와 동일 필드).
// collectedAt 날짜 비교는 utils/date.ts의 로컬 날짜 기준을 공유한다(writeDocumentsJob·
// deleteTodaysJobPostings·추천 팝업과 동일 규칙).
async function countTargets(): Promise<number> {
  const jobs = await getJobPostings();
  return jobs.filter((j) => isCollectedToday(j.collectedAt) && !j.documents?.matchReport).length;
}

// Claude Code CLI를 headless로 실행해 매칭률 사전 평가표(§6-1/6-2)만 작성하게 한다.
// 자소서·경력기술서는 만들지 않고 documents.matchReport만 채운다. 나머지 문서 필드(coverLetter·intro·
// workExperience)는 빈 문자열로 둬, 이후 문서 작성 배치가 coverLetter가 비어 있음을 보고 자소서를 채운다.
// 프롬프트는 셸 이스케이프 문제를 피하기 위해 stdin으로 전달한다.
// todayKey는 서버가 계산한 로컬 날짜다. collectedAt은 UTC ISO라 앞 10자를 그대로 비교하면
// 로컬 00:00~09:00 수집분이 전날로 밀리므로, 판정 기준을 프롬프트에 명시해 넘긴다.
function runClaudeMatchCheck(todayKey: string): Promise<void> {
  const prompt = [
    "매칭률 조회 배치를 실행해줘.",
    `대상: backend/src/data/jobPostings.json에서 collectedAt(UTC ISO)을 로컬 시간대로 변환한 날짜가 ${todayKey}인 공고 중,`,
    "documents.matchReport가 없는 공고 전부(documents가 null이거나, documents는 있어도 matchReport가 비어 있는 경우).",
    "각 대상 공고에 대해 .claude/skills/write-documents/SKILL.md의",
    "'§6-1 매칭률 사전 평가 + §6-2 지원 권장도' 형식만 작성해(자소서·경력기술서·소개는 만들지 마).",
    "- 필수 자격요건/스택/담당업무/우대사항 매칭, 강점 Top 3, 갭 Top 3~5를 포함하고,",
    "- 반드시 '종합 매칭률: N%' 한 줄을 포함할 것(대시보드가 이 문자열로 매칭률을 파싱한다).",
    "- 지원 권장도와 다른 공고 대비 간단 비교도 포함.",
    "프로필은 backend/src/data/userProfile.json에서 로드해(SKILL §8 필드 매핑). 개인 정보는 하드코딩하지 마.",
    "저장 위치: 각 공고 객체의 documents 객체 안 \"matchReport\" 필드(문자열)에 저장해.",
    "  - documents가 null이면 새로 만들되 { matchReport, coverLetter: \"\", intro: \"\", workExperience: \"\", generatedAt: <ISO시각> } 형태로 넣어(자소서·경력기술서·소개는 빈 문자열로 둬).",
    "  - documents가 이미 있으면 그 안의 matchReport만 채우고 coverLetter/intro/workExperience 등 기존 값은 절대 건드리지 마.",
    "Bash 도구는 사용하지 말고 Read/Edit/Write 도구만으로 jobPostings.json을 수정해.",
    "저장 직전에 파일을 다시 읽어 id 기준으로 병합할 것(서버가 파일을 동시에 쓸 수 있음).",
    "서버 재시작·git 작업은 하지 마. 완료 후 처리한 공고 수와 회사·종합 매칭률 목록을 보고해.",
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
      console.log("[matchCheckJob] claude 결과:", stdout.slice(-2000));
      if (code === 0) resolve();
      else reject(new Error(`claude CLI 종료 코드 ${code}: ${stderr.slice(-500)}`));
    });

    child.stdin.write(prompt, "utf-8");
    child.stdin.end();
  });
}

// 대시보드 [UPDATE] 흐름에서 수집 → 평점 조회 이후 마지막 단계로 호출된다.
// 매칭률 미평가 신규 공고가 있으면 실행하고, 없으면 실행 이력을 남기지 않고 건너뛴다.
export async function runMatchCheckIfNeeded(): Promise<RunRecord | null> {
  // 프로필이 없으면 매칭 기준이 없어 매칭률 평가를 돌릴 수 없다(collect 체인·스케줄 공통 진입점).
  if (!(await hasProfile())) {
    console.log("[matchCheckJob] 프로필 미작성 — 매칭률 조회 배치 건너뜀");
    return null;
  }
  const targetCount = await countTargets();
  if (targetCount === 0) {
    console.log("[matchCheckJob] 매칭률 평가 대상 없음 — 건너뜀");
    return null;
  }
  console.log(`[matchCheckJob] 매칭률 평가 대상 ${targetCount}건 — Claude 매칭률 조회 배치 시작`);
  const todayKey = todayLocalKey();
  return runManualJob(MATCH_CHECK_JOB_NAME, () => runClaudeMatchCheck(todayKey));
}
