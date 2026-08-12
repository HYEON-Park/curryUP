import { useEffect, useState } from "react";
import type { CareerEntry, CareerInfo } from "../types";
import { POSITION_OPTIONS } from "../data/profileFormMeta";
import { JobTitlePicker } from "./JobTitlePicker";
import { CardHeader } from "./CardHeader";
import { FieldLabel } from "./FieldLabel";
import { PeriodRange } from "./PeriodRange";
import { charCount, formatExperience, totalCareerMonths } from "../utils/profileDerive";

interface CareerFormProps {
  value: CareerInfo | undefined;
  onChange: (next: CareerInfo) => void;
}

const DESC_LIMIT = 2000;

const EMPTY_CAREER: CareerEntry = {
  companyName: "",
  startYM: "",
  endYM: "",
  isWorking: false,
  jobTitle: "",
  department: "",
  position: "",
  description: "",
};

export function CareerForm({ value, onChange }: CareerFormProps) {
  const careers = value?.careers ?? [];
  const totalMonths = totalCareerMonths(careers);

  // 카드 펼침 상태(첫 항목만 펼침, 새로 추가하면 펼침)
  const [openList, setOpenList] = useState<boolean[]>([]);
  useEffect(() => {
    setOpenList((prev) => {
      if (prev.length === careers.length) return prev;
      return careers.map((_, i) => prev[i] ?? i === 0);
    });
  }, [careers.length]);

  function commit(next: CareerEntry[]) {
    onChange({ totalExperience: formatExperience(totalCareerMonths(next)), careers: next });
  }

  function addCareer() {
    commit([...careers, { ...EMPTY_CAREER }]);
    setOpenList((prev) => [...prev, true]);
  }

  function removeCareer(index: number) {
    commit(careers.filter((_, i) => i !== index));
    setOpenList((prev) => prev.filter((_, i) => i !== index));
  }

  function toggle(index: number) {
    setOpenList((prev) => prev.map((v, i) => (i === index ? !v : v)));
  }

  function updateCareer(index: number, patch: Partial<CareerEntry>) {
    commit(careers.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  return (
    <div className="entry-form">
      <div className="section-head">
        <div className="section-head-left">
          <span className="section-title">경력</span>
          <span className="req-badge">필수</span>
          <span className="total-badge">총 {formatExperience(totalMonths)}</span>
        </div>
        <button type="button" className="section-add-btn" onClick={addCareer}>
          + 경력 추가
        </button>
      </div>

      {careers.length === 0 && (
        <p className="entry-empty">아직 등록한 경력이 없습니다. “+ 경력 추가”로 입력하세요.</p>
      )}

      {careers.map((c, i) => {
        const collapsed = !(openList[i] ?? i === 0);
        return (
          <div key={i} className="entry-card">
            <CardHeader
              index={i}
              summary={c.companyName}
              placeholder="회사명을 입력하세요"
              collapsed={collapsed}
              onToggle={() => toggle(i)}
              onRemove={() => removeCareer(i)}
            />

            {!collapsed && (
              <div className="entry-card-body">
                {/* ① 회사명 · 직무 */}
                <div className="field-grid-2">
                  <label className="entry-field">
                    <FieldLabel required>회사명</FieldLabel>
                    <input
                      value={c.companyName}
                      onChange={(e) => updateCareer(i, { companyName: e.target.value })}
                      placeholder="예: 뱅크웨어글로벌"
                    />
                  </label>
                  <label className="entry-field">
                    <FieldLabel required>직무</FieldLabel>
                    <JobTitlePicker
                      value={c.jobTitle}
                      onChange={(jobTitle) => updateCareer(i, { jobTitle })}
                    />
                  </label>
                </div>

                {/* ② 근무기간 */}
                <label className="entry-field">
                  <FieldLabel required>근무기간</FieldLabel>
                  <PeriodRange
                    startYM={c.startYM}
                    endYM={c.endYM}
                    onChange={(patch) => updateCareer(i, patch)}
                    current={c.isWorking}
                    onCurrentChange={(v) => updateCareer(i, { isWorking: v, endYM: v ? "" : c.endYM })}
                    currentLabel="재직중"
                    showDuration
                  />
                </label>

                {/* ③ 근무부서 · 직급 */}
                <div className="field-grid-2">
                  <label className="entry-field">
                    <FieldLabel>근무부서</FieldLabel>
                    <input
                      value={c.department}
                      onChange={(e) => updateCareer(i, { department: e.target.value })}
                      placeholder="예: Channel Unit"
                    />
                  </label>
                  <label className="entry-field">
                    <FieldLabel>직급/직책</FieldLabel>
                    <select value={c.position} onChange={(e) => updateCareer(i, { position: e.target.value })}>
                      <option value="">선택</option>
                      {POSITION_OPTIONS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* ④ 담당업무 */}
                <label className="entry-field">
                  <span className="field-label-row">
                    <FieldLabel>담당업무</FieldLabel>
                    <span className="char-counter">
                      {charCount(c.description).toLocaleString()}자 / {DESC_LIMIT.toLocaleString()}자
                    </span>
                  </span>
                  <textarea
                    className="desc-textarea"
                    maxLength={DESC_LIMIT}
                    value={c.description}
                    onChange={(e) => updateCareer(i, { description: e.target.value })}
                    placeholder="프로젝트 및 세부 담당업무를 작성하세요."
                  />
                  <span className="field-helper">AI가 지원서 초안 작성 시 이 내용을 활용합니다.</span>
                </label>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
