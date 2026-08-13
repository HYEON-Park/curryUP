import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/services → 3단계 위가 리포지토리 루트(C:\R). CLI를 이 경로에서 실행해야
// frontend/src/*.ts 스키마 파일을 상대 경로로 읽을 수 있다.
const REPO_ROOT = path.resolve(__dirname, "../../..");

// PDF 이력서 파싱은 기존 문서 생성 배치와 동일하게 claude CLI를 headless로 돌린다
// (API 키·토큰 과금 없음, 구독 인증 사용). 다만 파일을 수정하지 않고 Read만 하며,
// 결과 JSON을 stdout으로만 받아 프로필 폼에 주입할 수 있게 한다.

// 프로필 폼에 주입할 파싱 결과(부분 UserProfile). 검증·정규화 후 반환한다.
export interface ParsedResume {
  yearsOfExperience: number | null;
  skills: string[];
  certifications: string[];
  locations: string[];
  desiredRoleCategories: string[];
  careerInfo: {
    totalExperience: string;
    careers: Array<{
      companyName: string;
      startYM: string;
      endYM: string;
      isWorking: boolean;
      jobTitle: string;
      department: string;
      position: string;
      description: string;
    }>;
  };
  educationInfo: {
    highestLevel: string;
    educations: Array<Record<string, unknown>>;
  };
  slogan: string;
  careerNarrative: string;
  careerDirection: string;
  interestDomains: string;
  representativeMetrics: string;
  sideProjects: string;
  learningStack: string;
  aiToolUsage: string;
}

// YYYYMM 6자리 정규화: 숫자만 남기고 6자리·월 01~12·연도 1900~2100이면 유지, 아니면 "".
// CLI가 이미 YYYYMM으로 출력하지만 "2025.07" 등 형식 흔들림을 방어한다.
function normalizeYM(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length !== 6) return "";
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  if (year < 1900 || year > 2100 || month < 1 || month > 12) return "";
  return digits;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

// stdout에서 JSON 객체를 추출한다. ```json 코드블록 우선, 없으면 첫 { ~ 마지막 }.
function extractJson(stdout: string): unknown {
  const fenced = stdout.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced
    ? fenced[1]
    : stdout.slice(stdout.indexOf("{"), stdout.lastIndexOf("}") + 1);
  return JSON.parse(raw);
}

// CLI가 돌려준 원본 객체를 폼 스키마로 검증·정규화한다(유효값은 CLI가 소스 파일을
// 읽어 매핑하므로 여기서는 형식/타입 방어와 날짜 정규화만 한다).
function normalize(parsed: Record<string, unknown>): ParsedResume {
  const careerInfoRaw = (parsed.careerInfo ?? {}) as Record<string, unknown>;
  const careersRaw = Array.isArray(careerInfoRaw.careers) ? careerInfoRaw.careers : [];
  const careers = careersRaw.map((c) => {
    const entry = (c ?? {}) as Record<string, unknown>;
    const isWorking = entry.isWorking === true;
    return {
      companyName: asString(entry.companyName),
      startYM: normalizeYM(entry.startYM),
      endYM: isWorking ? "" : normalizeYM(entry.endYM),
      isWorking,
      jobTitle: asString(entry.jobTitle),
      department: asString(entry.department),
      position: asString(entry.position),
      description: asString(entry.description),
    };
  });

  const eduInfoRaw = (parsed.educationInfo ?? {}) as Record<string, unknown>;
  const edusRaw = Array.isArray(eduInfoRaw.educations) ? eduInfoRaw.educations : [];
  const educations = edusRaw.map((e) => {
    const entry = (e ?? {}) as Record<string, unknown>;
    // EducationEntry 스키마 키만 화이트리스트로 통과시킨다(스키마에 없는 필드는 무시).
    const out: Record<string, unknown> = {
      category: asString(entry.category),
      schoolName: asString(entry.schoolName),
      status: asString(entry.status),
      startYM: normalizeYM(entry.startYM),
      endYM: normalizeYM(entry.endYM),
    };
    for (const key of ["degreeType", "major", "track", "gpa", "subMajor", "dayNight", "recognizedLevel", "field", "region"] as const) {
      if (typeof entry[key] === "string" && (entry[key] as string).trim() !== "") out[key] = entry[key];
    }
    if (entry.isGED === true) out.isGED = true;
    if (entry.isTransfer === true) out.isTransfer = true;
    return out;
  });

  const yoe = parsed.yearsOfExperience;

  return {
    yearsOfExperience: typeof yoe === "number" ? yoe : null,
    skills: asStringArray(parsed.skills),
    certifications: asStringArray(parsed.certifications),
    locations: asStringArray(parsed.locations),
    desiredRoleCategories: asStringArray(parsed.desiredRoleCategories),
    careerInfo: { totalExperience: asString(careerInfoRaw.totalExperience), careers },
    educationInfo: { highestLevel: asString(eduInfoRaw.highestLevel), educations },
    slogan: asString(parsed.slogan),
    careerNarrative: asString(parsed.careerNarrative),
    careerDirection: asString(parsed.careerDirection),
    interestDomains: asString(parsed.interestDomains),
    representativeMetrics: asString(parsed.representativeMetrics),
    sideProjects: asString(parsed.sideProjects),
    learningStack: asString(parsed.learningStack),
    aiToolUsage: asString(parsed.aiToolUsage),
  };
}

function buildPrompt(pdfPath: string): string {
  return [
    "PDF 이력서를 읽어 프로필 폼에 채울 JSON을 만들어줘.",
    `대상 PDF: ${pdfPath} (Read 도구로 읽어. PDF/이미지를 읽을 수 있음.)`,
    "",
    "스키마·유효값은 아래 소스 파일에서 직접 확인해(반드시 유효한 enum/라벨만 사용):",
    "- frontend/src/types.ts : UserProfile·CareerEntry·EducationEntry·EducationCategory 구조",
    "- frontend/src/data/profileFormMeta.ts : POSITION_OPTIONS(직급)·UNIVERSITY_DEGREE_TYPES(대학구분)·EDUCATION_STATUS(졸업상태)·REGION_OPTIONS(지역)·EDUCATION_LEVELS(category enum)",
    "- frontend/src/data/jobCategoryMeta.ts : desiredRoleCategories·jobTitle에 넣을 수 있는 유효 라벨(categories/detail)",
    "",
    "추출 규칙:",
    '- 날짜는 모두 YYYYMM 6자리 문자열(예: 2025.07 → "202507"). "재직중"이면 isWorking=true, endYM="".',
    "- careerInfo.careers[]: 회사명(companyName)·부서(department)·직급(position, POSITION_OPTIONS 중 하나로 매핑)·",
    "  직무(jobTitle, jobCategoryMeta의 유효 라벨로 매핑)·startYM·endYM·isWorking·description(해당 회사의 담당업무/경력기술 요약).",
    "  경력기술서(별도 섹션)의 프로젝트 설명은 회사명·기간으로 올바른 경력 카드에 매칭해 description에 넣어.",
    '  totalExperience는 이력서의 "총 N년 N개월"이 있으면 그대로.',
    "- educationInfo.educations[]: category(UNIVERSITY 등 enum)·schoolName·degreeType(UNIVERSITY_DEGREE_TYPES)·major·status(EDUCATION_STATUS)·startYM·endYM·region(REGION_OPTIONS).",
    "- skills[]: 스킬 배열. certifications[]: 자격증명. locations[]: 근무 희망/근무 지역(REGION_OPTIONS 라벨).",
    "- desiredRoleCategories[]: 이력서의 직무/스킬을 jobCategoryMeta 유효 라벨로 매핑(맞는 게 없으면 넣지 마).",
    '- slogan·careerNarrative·careerDirection·interestDomains·representativeMetrics·sideProjects·learningStack·aiToolUsage: 소개글·개인 프로젝트/학습 등이 있으면 채우고 없으면 "".',
    "",
    "[생성 필수 조건] 위 스키마(types.ts의 UserProfile/CareerEntry/EducationEntry)에 정의된 필드만 출력해.",
    "스키마에 없는 필드(이메일·전화·나이·성별·주소·사진·포트폴리오 URL 등)는 무시하고 JSON에 절대 포함하지 마.",
    "",
    "출력: 오직 하나의 JSON 객체만 ```json 코드블록으로 출력해. 그 외 설명 텍스트 금지.",
    "파일을 절대 수정하지 마(Read만 사용). Bash·git·서버 조작 금지.",
    "",
    "JSON 형태(값 없으면 빈 배열/빈 문자열):",
    '{ "yearsOfExperience": null, "skills": [], "certifications": [], "locations": [], "desiredRoleCategories": [],',
    '  "careerInfo": { "totalExperience": "", "careers": [ { "companyName": "", "startYM": "", "endYM": "", "isWorking": false, "jobTitle": "", "department": "", "position": "", "description": "" } ] },',
    '  "educationInfo": { "highestLevel": "", "educations": [ { "category": "", "schoolName": "", "status": "", "startYM": "", "endYM": "", "degreeType": "", "major": "", "region": "" } ] },',
    '  "slogan": "", "careerNarrative": "", "careerDirection": "", "interestDomains": "", "representativeMetrics": "", "sideProjects": "", "learningStack": "", "aiToolUsage": "" }',
  ].join("\n");
}

function runClaude(prompt: string): Promise<string> {
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
      if (code === 0) resolve(stdout);
      else reject(new Error(`claude CLI 종료 코드 ${code}: ${stderr.slice(-500)}`));
    });

    child.stdin.write(prompt, "utf-8");
    child.stdin.end();
  });
}

// PDF 버퍼를 받아 임시 파일로 저장 → claude CLI로 파싱 → JSON 반환 → 임시 파일 삭제.
// 개인정보 보호: 임시 파일은 파싱 직후(성공·실패 무관) 반드시 삭제한다.
export async function parseResumePdf(buffer: Buffer): Promise<ParsedResume> {
  // 임시 PDF는 반드시 리포지토리(=CLI cwd) 안에 둔다. headless claude -p는 프로젝트
  // 밖 파일 Read에 권한 승인이 필요해(무인 모드에선 거부) 못 읽는다. .gitignore로 커밋 차단.
  const tmpDir = await mkdtemp(path.join(REPO_ROOT, ".resume-tmp-"));
  const pdfPath = path.join(tmpDir, `${randomUUID()}.pdf`);
  try {
    await writeFile(pdfPath, buffer);
    const stdout = await runClaude(buildPrompt(pdfPath));
    let parsed: unknown;
    try {
      parsed = extractJson(stdout);
    } catch {
      throw new Error(`CLI가 JSON을 반환하지 않았습니다. 출력 tail: ${stdout.slice(-500) || "(빈 출력)"}`);
    }
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("파싱 결과가 JSON 객체가 아닙니다.");
    }
    return normalize(parsed as Record<string, unknown>);
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
