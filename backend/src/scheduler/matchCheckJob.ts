import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getJobPostings } from "../data/store.js";
import { runManualJob, type RunRecord } from "./runLog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

export const MATCH_CHECK_JOB_NAME = "매칭률조회";

// 대상: 오늘(collectedAt ISO 날짜 기준) 수집된 공고 중 아직 매칭률 평가표가 없는 공고.
// documents.matchReport(전체 문서 작성 배치 산출물) 또는 top-level matchReport 중 하나라도 있으면 제외.
// collectedAt 날짜 비교는 writeDocumentsJob/deleteTodaysJobPostings와 동일하게 ISO(UTC) 날짜 문자열 기준.
async function countTargets(): Promise<number> {
  const jobs = await getJobPostings();
  const todayKey = new Date().toISOString().slice(0, 10);
  return jobs.filter(
    (j) => j.collectedAt.slice(0, 10) === todayKey && !j.matchReport && !j.documents?.matchReport
  ).length;
}

// Claude Code CLI를 headless로 실행해 매칭률 사전 평가표(§6-1/6-2)만 작성하게 한다.
// 자소서·경력기술서는 만들지 않고 top-level matchReport 필드만 채운다(전체 문서 작성 배치와 분리).
// 프롬프트는 셸 이스케이프 문제를 피하기 위해 stdin으로 전달한다.
function runClaudeMatchCheck(): Promise<void> {
  const prompt = [
    "매칭률 조회 배치를 실행해줘.",
    "대상: backend/src/data/jobPostings.json에서 collectedAt의 ISO 날짜(앞 10자)가 오늘과 같은 공고 중,",
    "top-level matchReport 필드가 비어 있고 documents.matchReport도 없는 공고 전부.",
    "각 대상 공고에 대해 .claude/skills/write-documents/SKILL.md의",
    "'§6-1 매칭률 사전 평가 + §6-2 지원 권장도' 형식만 작성해(자소서·경력기술서·소개는 만들지 마).",
    "- 필수 자격요건/스택/담당업무/우대사항 매칭, 강점 Top 3, 갭 Top 3~5를 포함하고,",
    "- 반드시 '종합 매칭률: N%' 한 줄을 포함할 것(대시보드가 이 문자열로 매칭률을 파싱한다).",
    "- 지원 권장도와 다른 공고 대비 간단 비교도 포함.",
    "프로필은 backend/src/data/userProfile.json에서 로드해 SKILL §8 프로필과 대조해.",
    "작성 결과는 각 공고 객체의 top-level \"matchReport\" 필드(문자열)에 저장하고,",
    "\"matchReportAt\"에 ISO 시각을 기록해. documents 필드는 절대 건드리지 마.",
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
  const targetCount = await countTargets();
  if (targetCount === 0) {
    console.log("[matchCheckJob] 매칭률 평가 대상 없음 — 건너뜀");
    return null;
  }
  console.log(`[matchCheckJob] 매칭률 평가 대상 ${targetCount}건 — Claude 매칭률 조회 배치 시작`);
  return runManualJob(MATCH_CHECK_JOB_NAME, runClaudeMatchCheck);
}
