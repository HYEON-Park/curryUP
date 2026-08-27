import { useEffect, useState, type ReactElement } from "react";
import type { EducationCategory, EducationEntry, EducationInfo } from "../types";
import {
  DAY_NIGHT_OPTIONS,
  EDUCATION_LEVELS,
  EDUCATION_STATUS,
  HIGH_SCHOOL_TRACKS,
  RECOGNIZED_LEVELS,
  REGION_OPTIONS,
  UNIVERSITY_DEGREE_TYPES,
} from "../data/profileFormMeta";
import { deriveHighestLevel } from "../utils/profileDerive";
import { CardHeader } from "./CardHeader";
import { FieldLabel } from "./FieldLabel";
import { PeriodRange } from "./PeriodRange";

interface EducationFormProps {
  value: EducationInfo | undefined;
  onChange: (next: EducationInfo) => void;
}

function baseEntry(category: EducationCategory): EducationEntry {
  return { category, schoolName: "", status: "", startYM: "", endYM: "" };
}

export function EducationForm({ value, onChange }: EducationFormProps) {
  const educations = value?.educations ?? [];

  const [openList, setOpenList] = useState<boolean[]>([]);
  useEffect(() => {
    setOpenList((prev) => {
      if (prev.length === educations.length) return prev;
      return educations.map((_, i) => prev[i] ?? i === 0);
    });
  }, [educations.length]);

  function commit(next: EducationEntry[]) {
    onChange({ highestLevel: deriveHighestLevel(next), educations: next });
  }

  function addEducation() {
    commit([...educations, baseEntry("UNIVERSITY")]);
    setOpenList((prev) => [...prev, true]);
  }

  function removeEducation(index: number) {
    commit(educations.filter((_, i) => i !== index));
    setOpenList((prev) => prev.filter((_, i) => i !== index));
  }

  function toggle(index: number) {
    setOpenList((prev) => prev.map((v, i) => (i === index ? !v : v)));
  }

  function updateEdu(index: number, patch: Partial<EducationEntry>) {
    commit(educations.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  // 학력 구분 변경 시 이전 입력값 reset
  function changeCategory(index: number, category: EducationCategory) {
    commit(educations.map((e, i) => (i === index ? baseEntry(category) : e)));
  }

  function statusField(index: number) {
    const e = educations[index];
    return (
      <label className="entry-field">
        <FieldLabel>졸업 상태</FieldLabel>
        <select value={e.status} onChange={(ev) => updateEdu(index, { status: ev.target.value })}>
          <option value="">선택</option>
          {EDUCATION_STATUS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
    );
  }

  function schoolField(index: number, label: string) {
    const e = educations[index];
    return (
      <label className="entry-field">
        <FieldLabel required>{label}</FieldLabel>
        <input
          value={e.schoolName}
          onChange={(ev) => updateEdu(index, { schoolName: ev.target.value })}
          placeholder="학교/학원명"
        />
      </label>
    );
  }

  function periodField(index: number) {
    const e = educations[index];
    return (
      <label className="entry-field">
        <FieldLabel>재학기간</FieldLabel>
        <PeriodRange
          startYM={e.startYM}
          endYM={e.endYM}
          onChange={(patch) => updateEdu(index, patch)}
        />
      </label>
    );
  }

  // "+ 항목" 동적 추가 필드(학점/추가전공/주야간)
  function optionalField(
    index: number,
    key: "gpa" | "subMajor" | "dayNight",
    addLabel: string,
    render: (e: EducationEntry) => ReactElement
  ) {
    const e = educations[index];
    if (e[key] === undefined) {
      return (
        <button type="button" className="add-optional-btn" onClick={() => updateEdu(index, { [key]: "" })}>
          {addLabel}
        </button>
      );
    }
    return (
      <div className="optional-row">
        {render(e)}
        <button
          type="button"
          className="optional-remove-btn"
          onClick={() => updateEdu(index, { [key]: undefined })}
          aria-label="삭제"
        >
          ×
        </button>
      </div>
    );
  }

  function renderFields(e: EducationEntry, i: number) {
    switch (e.category) {
      case "ELEMENTARY":
      case "MIDDLE":
        return (
          <>
            <div className="field-grid-2">
              {schoolField(i, "학교명")}
              {statusField(i)}
            </div>
            {periodField(i)}
          </>
        );

      case "HIGH_SCHOOL":
        return (
          <>
            <div className="edu-checks">
              <label>
                <input
                  type="checkbox"
                  checked={!!e.isGED}
                  onChange={(ev) => updateEdu(i, { isGED: ev.target.checked })}
                />
                대입 검정고시
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!e.isTransfer}
                  onChange={(ev) => updateEdu(i, { isTransfer: ev.target.checked })}
                />
                편입
              </label>
            </div>
            <div className="field-grid-2">
              {schoolField(i, "학교명")}
              {statusField(i)}
            </div>
            <div className="field-grid-2">
              <label className="entry-field">
                <FieldLabel>전공계열</FieldLabel>
                <select value={e.track ?? ""} onChange={(ev) => updateEdu(i, { track: ev.target.value })}>
                  <option value="">선택</option>
                  {HIGH_SCHOOL_TRACKS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <span />
            </div>
            {periodField(i)}
          </>
        );

      case "UNIVERSITY":
        return (
          <>
            <div className="field-grid-2">
              <label className="entry-field">
                <FieldLabel required>대학구분</FieldLabel>
                <select
                  value={e.degreeType ?? ""}
                  onChange={(ev) => updateEdu(i, { degreeType: ev.target.value })}
                >
                  <option value="">선택</option>
                  {UNIVERSITY_DEGREE_TYPES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              {schoolField(i, "학교명")}
            </div>
            <div className="field-grid-2">
              <label className="entry-field">
                <FieldLabel required>전공</FieldLabel>
                <input
                  value={e.major ?? ""}
                  onChange={(ev) => updateEdu(i, { major: ev.target.value })}
                  placeholder="예: 컴퓨터공학과"
                />
              </label>
              {statusField(i)}
            </div>
            {periodField(i)}
            <div className="additional-info">
              <div className="additional-info-title">추가 정보</div>
              <div className="additional-info-buttons">
                {optionalField(i, "gpa", "+ 학점", (ed) => (
                  <label className="entry-field">
                    <FieldLabel>학점</FieldLabel>
                    <input
                      value={ed.gpa ?? ""}
                      onChange={(ev) => updateEdu(i, { gpa: ev.target.value })}
                      placeholder="예: 3.8/4.5"
                    />
                  </label>
                ))}
                {optionalField(i, "subMajor", "+ 추가전공", (ed) => (
                  <label className="entry-field">
                    <FieldLabel>추가전공</FieldLabel>
                    <input
                      value={ed.subMajor ?? ""}
                      onChange={(ev) => updateEdu(i, { subMajor: ev.target.value })}
                      placeholder="복수/부전공"
                    />
                  </label>
                ))}
                {optionalField(i, "dayNight", "+ 주/야간", (ed) => (
                  <label className="entry-field">
                    <FieldLabel>주/야간</FieldLabel>
                    <select value={ed.dayNight ?? ""} onChange={(ev) => updateEdu(i, { dayNight: ev.target.value })}>
                      <option value="">선택</option>
                      {DAY_NIGHT_OPTIONS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          </>
        );

      case "OTHER":
        return (
          <>
            <div className="field-grid-2">
              <label className="entry-field">
                <FieldLabel required>인정학력</FieldLabel>
                <select
                  value={e.recognizedLevel ?? ""}
                  onChange={(ev) => updateEdu(i, { recognizedLevel: ev.target.value })}
                >
                  <option value="">선택</option>
                  {RECOGNIZED_LEVELS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              {schoolField(i, "학교/학원명")}
            </div>
            <div className="field-grid-2">
              <label className="entry-field">
                <FieldLabel required>전공분야</FieldLabel>
                <input
                  value={e.field ?? ""}
                  onChange={(ev) => updateEdu(i, { field: ev.target.value })}
                  placeholder="전공분야"
                />
              </label>
              <label className="entry-field">
                <FieldLabel>지역</FieldLabel>
                <select value={e.region ?? ""} onChange={(ev) => updateEdu(i, { region: ev.target.value })}>
                  <option value="">선택</option>
                  {REGION_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {periodField(i)}
          </>
        );
    }
  }

  return (
    <div className="entry-form">
      <div className="section-head">
        <div className="section-head-left">
          <span className="section-title">학력</span>
        </div>
        <button type="button" className="section-add-btn" onClick={addEducation}>
          + 학력 추가
        </button>
      </div>

      {educations.length === 0 && (
        <p className="entry-empty">아직 등록한 학력이 없습니다. “+ 학력 추가”로 입력하세요.</p>
      )}

      {educations.map((e, i) => {
        const collapsed = !(openList[i] ?? i === 0);
        return (
          <div key={i} className="entry-card">
            <CardHeader
              index={i}
              summary={e.schoolName}
              placeholder="학교명을 입력하세요"
              collapsed={collapsed}
              onToggle={() => toggle(i)}
              onRemove={() => removeEducation(i)}
            />

            {!collapsed && (
              <div className="entry-card-body">
                <label className="entry-field">
                  <span className="field-label">학력 구분</span>
                  <select
                    value={e.category}
                    onChange={(ev) => changeCategory(i, ev.target.value as EducationCategory)}
                  >
                    {EDUCATION_LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
                {renderFields(e, i)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
