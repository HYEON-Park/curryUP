import { useState } from "react";
import { ROLE_CATEGORY_GROUPS, CATEGORY_SKILL_HINTS } from "../data/jobCategoryMeta";

interface JobCategoryPickerProps {
  selected: string[];
  onChange: (next: string[]) => void;
  skills: string[];
  onSkillsChange: (next: string[]) => void;
}

export function JobCategoryPicker({ selected, onChange, skills, onSkillsChange }: JobCategoryPickerProps) {
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const activeGroup = ROLE_CATEGORY_GROUPS[activeGroupIndex];

  // 대표 직무에 이미 있는 라벨은 상세 목록에서 제외(중복 체크박스 방지)
  const detailOnly = activeGroup.detail.filter((d) => !activeGroup.categories.includes(d));
  const selectedDetailCount = detailOnly.filter((d) => selected.includes(d)).length;

  function switchGroup(i: number) {
    setActiveGroupIndex(i);
    setDetailOpen(false);
  }

  function toggleCategory(category: string) {
    onChange(
      selected.includes(category) ? selected.filter((c) => c !== category) : [...selected, category]
    );
  }

  const allSelectedInGroup = activeGroup.categories.every((c) => selected.includes(c));

  function toggleSelectAll() {
    if (allSelectedInGroup) {
      onChange(selected.filter((c) => !activeGroup.categories.includes(c)));
    } else {
      const missing = activeGroup.categories.filter((c) => !selected.includes(c));
      onChange([...selected, ...missing]);
    }
  }

  const hintSkills = Array.from(
    new Set(
      [...activeGroup.categories, ...activeGroup.detail]
        .filter((c) => selected.includes(c))
        .flatMap((c) => CATEGORY_SKILL_HINTS[c] ?? [])
    )
  );

  function toggleSkill(skill: string) {
    onSkillsChange(
      skills.includes(skill) ? skills.filter((s) => s !== skill) : [...skills, skill]
    );
  }

  return (
    <div className="job-category-picker">
      <div className="job-category-tabs">
        {ROLE_CATEGORY_GROUPS.map((group, i) => (
          <button
            key={group.name}
            type="button"
            className={i === activeGroupIndex ? "active" : ""}
            onClick={() => switchGroup(i)}
          >
            {group.name}
          </button>
        ))}
      </div>

      <div className="job-category-list">
        <label className="job-category-select-all">
          <input type="checkbox" checked={allSelectedInGroup} onChange={toggleSelectAll} />
          대표 직무 전체선택
        </label>
        <div className="job-category-grid">
          {activeGroup.categories.map((category) => (
            <label key={category}>
              <input
                type="checkbox"
                checked={selected.includes(category)}
                onChange={() => toggleCategory(category)}
              />
              {category}
            </label>
          ))}
        </div>

        {detailOnly.length > 0 && (
          <div className="job-category-detail">
            <button
              type="button"
              className="job-category-detail-toggle"
              onClick={() => setDetailOpen((v) => !v)}
              aria-expanded={detailOpen}
            >
              {detailOpen ? "− 상세 직무 접기" : `+ 상세 직무 전체 보기 (${detailOnly.length})`}
              {!detailOpen && selectedDetailCount > 0 && (
                <span className="job-category-detail-badge">상세 {selectedDetailCount}개 선택됨</span>
              )}
            </button>
            {detailOpen && (
              <div className="job-category-grid job-category-grid-detail">
                {detailOnly.map((category) => (
                  <label key={category}>
                    <input
                      type="checkbox"
                      checked={selected.includes(category)}
                      onChange={() => toggleCategory(category)}
                    />
                    {category}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="job-category-skills">
        {hintSkills.length === 0 ? (
          <p className="job-category-skills-empty">직무를 선택하면 연관 기술 스택을 추천합니다.</p>
        ) : (
          hintSkills.map((skill) => (
            <button
              key={skill}
              type="button"
              className={skills.includes(skill) ? "job-category-skill-chip selected" : "job-category-skill-chip"}
              onClick={() => toggleSkill(skill)}
            >
              {skill}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
