import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProfile, saveProfile } from "../api/client";
import { ROLE_QUESTIONS, type UserProfile } from "../types";
import { TagInput } from "../components/TagInput";
import { AutoResizeTextarea } from "../components/AutoResizeTextarea";
import { LocationPicker } from "../components/LocationPicker";
import { JobCategoryPicker } from "../components/JobCategoryPicker";

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

function snapshotOf(profile: UserProfile) {
  return JSON.stringify({ ...profile, lastProfileUpdate: null });
}

export function ProfileEditPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [error, setError] = useState<string | null>(null);

  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);
  // 필수값 validation 실패 시 해당 필드로 포커스를 옮기기 위한 참조.
  const yearsRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLFieldSetElement>(null);
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

  // 카테고리 fieldset으로 스크롤 후 내부 첫 조작 요소(탭 버튼/체크박스)에 포커스한다.
  function focusCategory() {
    categoryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    categoryRef.current?.querySelector<HTMLElement>("button, input")?.focus();
  }

  // 필수값: 배치 매칭 기준이 되는 희망 직무 카테고리·경력 년차. (백엔드 PUT·배치 가드와 동일 기준)
  // 실패 시 안내 문구(message)와 해당 필드로 포커스를 옮기는 focus를 함께 돌려준다.
  function validate(): { message: string; focus: () => void } | null {
    if (profile.yearsOfExperience === null) {
      return { message: "경력 (년차)는 필수 입력 항목입니다.", focus: () => yearsRef.current?.focus() };
    }
    if (profile.yearsOfExperience < 0) {
      return { message: "경력 연차는 0 이상이어야 합니다.", focus: () => yearsRef.current?.focus() };
    }
    if (profile.desiredRoleCategories.length === 0) {
      return { message: "희망 직무 카테고리를 1개 이상 선택해주세요.", focus: focusCategory };
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
    await saveProfile(profile);
    navigate("/profile");
  }

  function handleCancel() {
    if (dirty && !window.confirm(UNSAVED_CHANGES_MESSAGE)) {
      return;
    }
    navigate("/profile");
  }

  const activeQuestions = profile.desiredRoleCategories.flatMap(
    (category) => ROLE_QUESTIONS[category] ?? []
  );

  return (
    <form onSubmit={handleSubmit} className="profile-edit-form">
      <h2>프로필 수정</h2>

      <label>
        경력 (년차) <span className="required-mark">*</span>
        <input
          ref={yearsRef}
          type="number"
          min={0}
          value={profile.yearsOfExperience ?? ""}
          onChange={(e) =>
            setProfile({
              ...profile,
              yearsOfExperience: e.target.value ? Math.max(0, Number(e.target.value)) : null,
            })
          }
        />
      </label>

      <label>
        기술 스택
        <TagInput
          value={profile.skills}
          onChange={(skills) => setProfile({ ...profile, skills })}
          placeholder="입력 후 Enter 또는 쉼표"
        />
      </label>

      <label>
        경력 사항
        <AutoResizeTextarea
          value={profile.careerHistory}
          onChange={(careerHistory) => setProfile({ ...profile, careerHistory })}
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
          학력
          <input
            value={profile.education ?? ""}
            onChange={(e) => setProfile({ ...profile, education: e.target.value })}
            placeholder="예: 컴퓨터과학과 학사 (2024.08 졸업)"
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

      {error && <p className="profile-error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="secondary" onClick={handleCancel}>
          취소
        </button>
        <button type="submit">저장</button>
      </div>
    </form>
  );
}
