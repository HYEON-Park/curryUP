import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProfile, parseResumePdf, saveProfile } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import {
  ROLE_QUESTIONS,
  type EducationCategory,
  type EducationEntry,
  type UserProfile,
} from "../types";
import { TagInput } from "../components/TagInput";
import { AutoResizeTextarea } from "../components/AutoResizeTextarea";
import { LocationPicker } from "../components/LocationPicker";
import { JobCategoryPicker } from "../components/JobCategoryPicker";
import { CareerForm } from "../components/CareerForm";
import { EducationForm } from "../components/EducationForm";
import {
  careerInfoToText,
  deriveYearsOfExperience,
  educationInfoToText,
  isValidYM,
} from "../utils/profileDerive";

const EMPTY_PROFILE: UserProfile = {
  yearsOfExperience: null,
  skills: [],
  careerHistory: "",
  certifications: [],
  locations: [],
  desiredRoleCategories: [],
  roleAnswers: {},
  lastProfileUpdate: null,
  sideProjects: "",
  learningStack: "",
  aiToolUsage: "",
  slogan: "",
  careerNarrative: "",
  education: "",
  careerDirection: "",
  interestDomains: "",
  representativeMetrics: "",
};

const UNSAVED_CHANGES_MESSAGE = "변경 사항이 저장되지 않을 수 있습니다. 나가시겠습니까?";

const EDUCATION_CATEGORIES: EducationCategory[] = [
  "ELEMENTARY",
  "MIDDLE",
  "HIGH_SCHOOL",
  "UNIVERSITY",
  "OTHER",
];

function snapshotOf(profile: UserProfile) {
  return JSON.stringify({ ...profile, lastProfileUpdate: null });
}

// PDF 파싱 결과(부분 UserProfile)를 폼 상태로 정규화한다.
// 데이터 갱신 정책: 기존 값을 모두 초기화(EMPTY_PROFILE)한 뒤 파싱값으로 덮어쓴다.
function parsedToProfile(parsed: Partial<UserProfile>, lastProfileUpdate: string | null): UserProfile {
  const careers = (parsed.careerInfo?.careers ?? []).map((c) => ({
    companyName: c.companyName ?? "",
    startYM: c.startYM ?? "",
    endYM: c.endYM ?? "",
    isWorking: c.isWorking ?? false,
    jobTitle: c.jobTitle ?? "",
    department: c.department ?? "",
    position: c.position ?? "",
    description: c.description ?? "",
  }));
  const educations: EducationEntry[] = (parsed.educationInfo?.educations ?? []).map((e) => ({
    ...e,
    category: EDUCATION_CATEGORIES.includes(e.category) ? e.category : "UNIVERSITY",
    schoolName: e.schoolName ?? "",
    status: e.status ?? "",
    startYM: e.startYM ?? "",
    endYM: e.endYM ?? "",
  }));

  return {
    ...EMPTY_PROFILE,
    ...parsed,
    roleAnswers: {},
    careerInfo: careers.length
      ? { totalExperience: parsed.careerInfo?.totalExperience ?? "", careers }
      : undefined,
    educationInfo: educations.length
      ? { highestLevel: parsed.educationInfo?.highestLevel ?? "", educations }
      : undefined,
    lastProfileUpdate,
  };
}

export function ProfileEditPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [error, setError] = useState<string | null>(null);

  // PDF 이력서 읽기 모달 상태.
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);
  // 필수값 validation 실패 시 해당 필드로 스크롤·포커스를 옮기기 위한 참조.
  const categoryRef = useRef<HTMLFieldSetElement>(null);
  const careerRef = useRef<HTMLFieldSetElement>(null);
  const educationRef = useRef<HTMLFieldSetElement>(null);
  const isDirtyRef = useRef(false);
  const dirty = initialSnapshot !== null && initialSnapshot !== snapshotOf(profile);

  useEffect(() => {
    isDirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    fetchProfile().then((data) => {
      setProfile(data);
      setInitialSnapshot(snapshotOf(data));
    });
  }, []);

  // 뒤로가기로 이탈을 시도하면 더미 히스토리 엔트리를 소비시켜 confirm을 띄우고,
  // 취소하면 같은 더미 엔트리를 다시 쌓아 이탈을 무효화한다.
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    function handlePopState() {
      if (isDirtyRef.current && !window.confirm(UNSAVED_CHANGES_MESSAGE)) {
        window.history.pushState(null, "", window.location.href);
        return;
      }
      navigate("/profile");
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [navigate]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // fieldset으로 스크롤 후 내부 첫 조작 요소에 포커스한다.
  function focusFieldset(ref: React.RefObject<HTMLFieldSetElement | null>) {
    return () => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      ref.current?.querySelector<HTMLElement>("button, input, select, textarea")?.focus();
    };
  }

  // 필수값 검증. 배치 매칭 기준(희망 직무 카테고리·경력 년차)과 경력/학력 폼 필수 항목·년월 포맷을 본다.
  function validate(): { message: string; focus: () => void } | null {
    if (profile.desiredRoleCategories.length === 0) {
      return { message: "희망 직무 카테고리를 1개 이상 선택해주세요.", focus: focusFieldset(categoryRef) };
    }

    const careers = profile.careerInfo?.careers ?? [];
    // 매칭 기준 연차는 경력 카드에서 파생한다. 카드가 없고 레거시 년차도 없으면 최소 1개 요구.
    if (careers.length === 0 && profile.yearsOfExperience === null) {
      return { message: "경력을 1개 이상 추가해주세요. (매칭 기준 연차 산정에 필요합니다)", focus: focusFieldset(careerRef) };
    }
    for (let i = 0; i < careers.length; i++) {
      const c = careers[i];
      const focus = focusFieldset(careerRef);
      if (!c.companyName.trim()) return { message: `경력 ${i + 1}: 회사명을 입력해주세요.`, focus };
      if (!c.jobTitle.trim()) return { message: `경력 ${i + 1}: 직무를 선택해주세요.`, focus };
      if (!isValidYM(c.startYM)) return { message: `경력 ${i + 1}: 입사년월을 YYYYMM 6자리로 입력해주세요.`, focus };
      if (!c.isWorking) {
        if (!isValidYM(c.endYM)) return { message: `경력 ${i + 1}: 재직년월을 YYYYMM 6자리로 입력해주세요.`, focus };
        if (c.endYM < c.startYM) return { message: `경력 ${i + 1}: 재직년월이 입사년월보다 빠릅니다.`, focus };
      }
    }

    const educations = profile.educationInfo?.educations ?? [];
    for (let i = 0; i < educations.length; i++) {
      const ed = educations[i];
      const focus = focusFieldset(educationRef);
      if (!ed.schoolName.trim()) return { message: `학력 ${i + 1}: 학교명을 입력해주세요.`, focus };
      if (ed.category === "UNIVERSITY") {
        if (!ed.degreeType) return { message: `학력 ${i + 1}: 대학구분을 선택해주세요.`, focus };
        if (!ed.major?.trim()) return { message: `학력 ${i + 1}: 전공을 입력해주세요.`, focus };
      }
      if (ed.category === "OTHER") {
        if (!ed.recognizedLevel) return { message: `학력 ${i + 1}: 인정학력을 선택해주세요.`, focus };
        if (!ed.field?.trim()) return { message: `학력 ${i + 1}: 전공분야를 입력해주세요.`, focus };
      }
      if (ed.startYM && !isValidYM(ed.startYM)) return { message: `학력 ${i + 1}: 입학년월을 YYYYMM 6자리로 입력해주세요.`, focus };
      if (ed.endYM && !isValidYM(ed.endYM)) return { message: `학력 ${i + 1}: 졸업년월을 YYYYMM 6자리로 입력해주세요.`, focus };
    }

    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError.message);
      validationError.focus();
      return;
    }
    setError(null);
    // 구조화 경력/학력 → 매칭 년차·문서 배치용 텍스트로 파생 저장(결정 B·C).
    const careers = profile.careerInfo?.careers ?? [];
    const toSave: UserProfile = {
      ...profile,
      yearsOfExperience: careers.length > 0 ? deriveYearsOfExperience(careers) : profile.yearsOfExperience,
      careerHistory: careerInfoToText(profile.careerInfo) || profile.careerHistory,
      education: educationInfoToText(profile.educationInfo) || profile.education,
    };
    await saveProfile(toSave);
    // 저장 후 인증 상태(hasProfile)를 갱신해야 온보딩(/profile/setup) 강제 이동이 풀린다.
    await refresh();
    navigate("/profile");
  }

  function handleCancel() {
    if (dirty && !window.confirm(UNSAVED_CHANGES_MESSAGE)) {
      return;
    }
    navigate("/profile");
  }

  function closePdfModal() {
    if (pdfLoading) return;
    setPdfModalOpen(false);
    setPdfFile(null);
    setPdfError(null);
  }

  // PDF 업로드 → 파싱 → 기존 폼 초기화 후 파싱값으로 덮어쓰기.
  async function handlePdfUpload() {
    if (!pdfFile || pdfLoading) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      const parsed = await parseResumePdf(pdfFile);
      setProfile(parsedToProfile(parsed, profile.lastProfileUpdate));
      setError(null);
      setPdfModalOpen(false);
      setPdfFile(null);
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : "PDF 파싱에 실패했습니다.");
    } finally {
      setPdfLoading(false);
    }
  }

  const activeQuestions = profile.desiredRoleCategories.flatMap(
    (category) => ROLE_QUESTIONS[category] ?? []
  );

  return (
    <form onSubmit={handleSubmit} className="profile-edit-form">
      <div className="edit-page-head">
        <h2>프로필 수정</h2>
        <button
          type="button"
          className="section-add-btn"
          onClick={() => {
            setPdfError(null);
            setPdfModalOpen(true);
          }}
        >
          PDF로 프로필 읽기
        </button>
      </div>

      {pdfModalOpen && (
        <div className="pdf-modal-overlay" onClick={closePdfModal}>
          <div
            className="pdf-modal-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdf-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="pdf-modal-title">PDF 이력서로 프로필 읽기</h3>
            <p className="pdf-modal-hint">
              PDF 이력서를 업로드하면 경력·학력·스킬 등을 자동으로 읽어 폼에 채웁니다.
              <br />
              기존에 입력한 값은 모두 초기화되고 새 내용으로 덮어쓰입니다.
            </p>
            <input
              type="file"
              accept="application/pdf,.pdf"
              disabled={pdfLoading}
              onChange={(e) => {
                setPdfFile(e.target.files?.[0] ?? null);
                setPdfError(null);
              }}
            />
            {pdfError && <p className="profile-error" role="alert">{pdfError}</p>}
            <div className="pdf-modal-actions">
              <button type="button" className="secondary" onClick={closePdfModal} disabled={pdfLoading}>
                취소
              </button>
              <button type="button" onClick={handlePdfUpload} disabled={!pdfFile || pdfLoading}>
                {pdfLoading ? "읽는 중…" : "업로드"}
              </button>
            </div>
          </div>
        </div>
      )}

      <fieldset ref={categoryRef}>
        <legend>희망 직무 카테고리 <span className="required-mark">*</span></legend>
        <JobCategoryPicker
          selected={profile.desiredRoleCategories}
          onChange={(desiredRoleCategories) => setProfile({ ...profile, desiredRoleCategories })}
          skills={profile.skills}
          onSkillsChange={(skills) => setProfile({ ...profile, skills })}
        />
      </fieldset>

      {activeQuestions.length > 0 && (
        <fieldset>
          <legend>직무별 추가 질문</legend>
          {activeQuestions.map((question) => (
            <label key={question}>
              {question}
              <input
                value={profile.roleAnswers[question] ?? ""}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    roleAnswers: { ...profile.roleAnswers, [question]: e.target.value },
                  })
                }
              />
            </label>
          ))}
        </fieldset>
      )}

      <fieldset ref={careerRef} aria-label="경력">
        <CareerForm
          value={profile.careerInfo}
          onChange={(careerInfo) => setProfile({ ...profile, careerInfo })}
        />
      </fieldset>

      <fieldset ref={educationRef} aria-label="학력">
        <EducationForm
          value={profile.educationInfo}
          onChange={(educationInfo) => setProfile({ ...profile, educationInfo })}
        />
      </fieldset>

      <label>
        기술 스택
        <TagInput
          value={profile.skills}
          onChange={(skills) => setProfile({ ...profile, skills })}
          placeholder="입력 후 Enter 또는 쉼표"
        />
      </label>

      <label>
        보유 자격증
        <TagInput
          value={profile.certifications}
          onChange={(certifications) => setProfile({ ...profile, certifications })}
          placeholder="입력 후 Enter 또는 쉼표"
        />
      </label>

      <label>
        근무지
        <LocationPicker
          value={profile.locations}
          onChange={(locations) => setProfile({ ...profile, locations })}
        />
      </label>

      <fieldset>
        <legend>추가 정보 (선택)</legend>
        <label>
          진행 중인 개인 프로젝트
          <AutoResizeTextarea
            value={profile.sideProjects ?? ""}
            onChange={(sideProjects) => setProfile({ ...profile, sideProjects })}
            placeholder="사이드 프로젝트, 오픈소스 기여 등"
          />
        </label>
        <label>
          학습 중인 기술
          <AutoResizeTextarea
            value={profile.learningStack ?? ""}
            onChange={(learningStack) => setProfile({ ...profile, learningStack })}
            placeholder="현재 공부하고 있는 기술/툴"
          />
        </label>
        <label>
          AI 도구 활용 경험
          <AutoResizeTextarea
            value={profile.aiToolUsage ?? ""}
            onChange={(aiToolUsage) => setProfile({ ...profile, aiToolUsage })}
            placeholder="업무나 학습에 활용한 AI 도구 경험"
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>자소서 개인 자산 (선택)</legend>
        <p className="fieldset-hint">
          자기소개서·경력기술서 작성 배치가 참조하는 개인 자산입니다. 비워두면 해당 항목 없이 작성됩니다.
        </p>
        <label>
          대표 슬로건
          <input
            value={profile.slogan ?? ""}
            onChange={(e) => setProfile({ ...profile, slogan: e.target.value })}
            placeholder='문서마다 반복되는 본인만의 한 문장 (예: "끊김 없이 흐르고…")'
          />
        </label>
        <label>
          커리어 서사
          <AutoResizeTextarea
            value={profile.careerNarrative ?? ""}
            onChange={(careerNarrative) => setProfile({ ...profile, careerNarrative })}
            placeholder="지원 시 일관되게 이식할 커리어 스토리 (예: SI 4년 → 자체 솔루션 확신)"
          />
        </label>
        <label>
          커리어 방향성
          <input
            value={profile.careerDirection ?? ""}
            onChange={(e) => setProfile({ ...profile, careerDirection: e.target.value })}
            placeholder="예: SI → 자체 솔루션 회사"
          />
        </label>
        <label>
          관심 도메인
          <input
            value={profile.interestDomains ?? ""}
            onChange={(e) => setProfile({ ...profile, interestDomains: e.target.value })}
            placeholder="예: 금융·공공·솔루션 SW · AI Native 개발"
          />
        </label>
        <label>
          대표 수치 세트
          <AutoResizeTextarea
            value={profile.representativeMetrics ?? ""}
            onChange={(representativeMetrics) => setProfile({ ...profile, representativeMetrics })}
            placeholder="자소서 수치화에 재사용할 대표 성과 수치 (예: 서류 검증 누락 0건, 처리시간 24h→1h)"
          />
        </label>
      </fieldset>

      {error && <p className="profile-error" role="alert">{error}</p>}

      <div className="form-actions">
        <button type="button" className="secondary" onClick={handleCancel}>
          취소
        </button>
        <button type="submit">저장</button>
      </div>
    </form>
  );
}
