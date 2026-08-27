import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getJobPostings, hasProfile } from "../data/store.js";
import { isJobRunning, runManualJob } from "./runLog.js";
import { MATCH_CHECK_JOB_NAME } from "./matchCheckJob.js";
import { WRITE_DOCS_JOB_NAME } from "./writeDocumentsJob.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

// 공고 상세 페이지에서 사용자가 탭별로 직접 생성하는 문서 종류.
// 저장 위치는 documents.{docType} 한 곳을 그대로 재사용한다(coreCompetency는 핵심역량 전용 신규 필드).
export const DOC_TYPES = ["matchReport", "coreCompetency", "coverLetter", "intro", "workExperience"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export function isDocType(value: string): value is DocType {
  return (DOC_TYPES as readonly string[]).includes(value);
}

const DOC_LABELS: Record<DocType, string> = {
  matchReport: "매칭표",
  coreCompetency: "핵심역량",
  coverLetter: "자기소개서",
  intro: "소개",
  workExperience: "경력사항",
};

// runLog에 남길 배치 이름(관리자 이력 표시용). 종류별로 구분해 어떤 문서를 생성했는지 보이게 한다.
export function singleDocJobName(docType: DocType): string {
  return `문서생성:${DOC_LABELS[docType]}`;
}

// 현재 생성 중인 유저를 인메모리로 추적한다. HTTP 라우트에서 202 응답 전에 동기적으로 세팅해
// 동시 실행을 막고, 프런트 상태 폴링(running 판정)도 이 값으로 즉시 반영되게 한다.
// (서버 재시작 시 유실되지만, runLog의 running 레코드는 다음 기동 시 reconcile로 failed 처리된다.)
const activeByUser = new Map<string, { jobId: string; docType: DocType }>();

export function getActiveGeneration(userId: string): { jobId: string; docType: DocType } | undefined {
  return activeByUser.get(userId);
}

// 이 유저가 지금 문서를 생성 중인지(단일 문서 생성 또는 야간 문서/매칭 배치 진행 중).
// Claude CLI가 같은 jobPostings 파일을 쓰므로 동시 실행을 막는다.
export async function isGenerationBusy(userId: string): Promise<boolean> {
  if (activeByUser.has(userId)) return true;
  if (await isJobRunning(userId, WRITE_DOCS_JOB_NAME)) return true;
  if (await isJobRunning(userId, MATCH_CHECK_JOB_NAME)) return true;
  return false;
}

// 특정 공고·탭 기준 생성 상태. 프런트가 폴링해 running=false + hasContent로 완료를,
// running=false + !hasContent로 실패를 판정한다.
export function getSingleDocState(
  userId: string,
  jobId: string,
  docType: DocType,
  content: string | undefined
): { running: boolean; hasContent: boolean } {
  const active = activeByUser.get(userId);
  const running = active?.jobId === jobId && active?.docType === docType;
  return { running, hasContent: Boolean(content && content.trim()) };
}

// 탭(docType)별로 생성할 내용의 지시문. 각 탭의 하위 항목을 전부 채우도록 SKILL 섹션을 지정한다.
function fieldInstruction(docType: DocType): string {
  switch (docType) {
    case "matchReport":
      return [
        "생성 대상: documents.matchReport (매칭률 사전 평가 + 지원 권장도).",
        ".claude/skills/write-documents/SKILL.md의 §6-0 매칭률 사전 평가 + 지원 권장도 형식으로 전체를 작성해:",
        "- 필수 자격요건/스택/담당업무/우대사항 매칭, 강점 Top 3, 갭 Top 3~5,",
        "- '종합 매칭률: N%' 한 줄 반드시 포함(대시보드가 이 문자열로 매칭률을 파싱한다),",
        "- 지원 권장도 및 다른 공고 대비 비교, §6-0 사용 시 체크포인트까지 모두 포함.",
        "저장 필드: documents.matchReport (문자열). coreCompetency/coverLetter/intro/workExperience는 절대 건드리지 마.",
      ].join("\n");
    case "coreCompetency":
      return [
        "생성 대상: documents.coreCompetency (핵심역량).",
        "SKILL.md §6-1 형식으로 핵심역량을 작성해: 5초 스캔용 요약, 최대 4줄.",
        "- 각 줄은 §2-0 키워드 3개 중 하나에 대응(3개 키워드 + 도메인/자격 1줄이 표준),",
        "- 형식 '**{역량명}** — {구체 근거}. {수치 또는 산출물}', 역량명은 공고 표현 그대로,",
        "- 근거에 기간·규모·수치 중 하나 이상 포함, 수치 있는 줄을 위로, 학력·자격은 마지막 줄에 묶음,",
        "- 태도 서술(성실함·책임감)·키워드 무관 역량·기술 나열만 있는 줄 금지.",
        "저장 필드: documents.coreCompetency (문자열). matchReport/coverLetter/intro/workExperience는 절대 건드리지 마.",
      ].join("\n");
    case "coverLetter":
      return [
        "생성 대상: documents.coverLetter (자기소개서).",
        "SKILL.md §6-3 지원동기(KKK) + §6-4 직무역량(유형 A 역량 나열형/유형 B 경험 서술형 중 문항에 맞게) + §6-5 입사 후 포부(3단계 구조)를 한 필드에 합쳐 작성해.",
        "§3 문체 규칙(인간화 리라이팅 포함)·§7 자가 검증 체크리스트를 적용해.",
        "documents.matchReport가 이미 있으면 그 매칭 분석을 참고하되 matchReport는 다시 만들지 마.",
        "저장 필드: documents.coverLetter (문자열). matchReport/coreCompetency/intro/workExperience는 절대 건드리지 마.",
      ].join("\n");
    case "intro":
      return [
        "생성 대상: documents.intro (자기소개 요약).",
        "핵심 강점·경력 요약·지원 직무 적합성을 담은 자기소개 요약을 2,000자 미만으로 작성해.",
        "§3 문체 규칙·금지어 규칙을 적용해.",
        "저장 필드: documents.intro (문자열). matchReport/coreCompetency/coverLetter/workExperience는 절대 건드리지 마.",
      ].join("\n");
    case "workExperience":
      return [
        "생성 대상: documents.workExperience (경력사항).",
        "SKILL.md §6-2 형식으로 경력사항을 작성해: 회사 헤더(재직기간)·프로젝트 헤더(수행기간) 구분, 프로젝트를 공고 관련성 순으로 재배치, 프로젝트당 불릿 최대 3개(수치 결과 줄 분리·굵게), 키워드 무관 항목 삭제.",
        "재직기간과 프로젝트 기간 합의 공백은 SM·유지보수 등으로 설명하는 항목을 반드시 넣어.",
        "저장 필드: documents.workExperience (문자열). matchReport/coreCompetency/coverLetter/intro는 절대 건드리지 마.",
      ].join("\n");
  }
}

// Claude Code CLI를 headless로 실행해 지정한 공고 1건의 지정 필드 1개만 작성하게 한다.
// 매칭률 조회·문서 작성 배치와 동일한 spawn 패턴(stdin 프롬프트, Read/Edit/Write 도구만).
function runClaudeSingleDoc(userId: string, jobId: string, docType: DocType): Promise<void> {
  const jobsFile = `backend/src/data/jobPostings/${userId}.json`;
  const profileFile = `backend/src/data/profiles/${userId}.json`;
  const prompt = [
    "단일 공고 문서 생성을 실행해줘.",
    `대상 공고: ${jobsFile}에서 id가 "${jobId}"인 공고 1건만 처리해(다른 공고는 절대 수정하지 마).`,
    `프로필은 ${profileFile}에서 로드해(SKILL §8 필드 매핑). 개인 정보는 하드코딩하지 마.`,
    fieldInstruction(docType),
    "저장 규칙:",
    '  - documents가 null이면 새로 만들되 { matchReport: "", coreCompetency: "", coverLetter: "", intro: "", workExperience: "", generatedAt: <ISO시각> } 형태에서 요청 필드만 채워.',
    "  - documents가 이미 있으면 요청 필드만 채우고 나머지 기존 값은 절대 건드리지 마. generatedAt은 현재 시각으로 갱신해.",
    `Bash 도구는 사용하지 말고 Read/Edit/Write 도구만으로 ${jobsFile}을 수정해.`,
    "저장 직전에 파일을 다시 읽어 id 기준으로 병합할 것(서버가 파일을 동시에 쓸 수 있음).",
    "서버 재시작·git 작업은 하지 마. 완료 후 처리한 공고와 작성한 필드를 보고해.",
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
      console.log(`[singleDocJob] ${docType} claude 결과:`, stdout.slice(-2000));
      if (code === 0) resolve();
      else reject(new Error(`claude CLI 종료 코드 ${code}: ${stderr.slice(-500)}`));
    });

    child.stdin.write(prompt, "utf-8");
    child.stdin.end();
  });
}

// 라우트에서 검증(프로필·공고 존재·busy) 이후 호출한다. active 플래그를 동기적으로 세팅하고
// runManualJob으로 감싸 실행 이력·실패 처리를 재사용하며, 완료 시 active를 해제한다.
// (fire-and-forget: 라우트는 이 함수를 await하지 않고 202로 즉시 응답한다.)
export function beginSingleDoc(userId: string, jobId: string, docType: DocType): void {
  activeByUser.set(userId, { jobId, docType });
  void runManualJob(userId, singleDocJobName(docType), () => runClaudeSingleDoc(userId, jobId, docType))
    .catch((error) => console.error(`[singleDocJob] ${docType} 실패:`, error))
    .finally(() => activeByUser.delete(userId));
}

// 라우트 진입점: 검증 후 생성 시작. 결과 코드로 라우트가 응답을 결정한다.
export async function startSingleDocGeneration(
  userId: string,
  jobId: string,
  docType: DocType
): Promise<"started" | "no-profile" | "not-found" | "busy"> {
  if (!(await hasProfile(userId))) return "no-profile";
  const jobs = await getJobPostings(userId);
  if (!jobs.some((j) => j.id === jobId)) return "not-found";
  if (await isGenerationBusy(userId)) return "busy";
  beginSingleDoc(userId, jobId, docType);
  return "started";
}
