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
  const activeGroup = ROLE_CATEGORY_GROUPS[activeGroupIndex];

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
      activeGroup.categories
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
            onClick={() => setActiveGroupIndex(i)}
          >
            {group.name}
          </button>
        ))}
      </div>

      <div className="job-category-list">
        <label className="job-category-select-all">
          <input type="checkbox" checked={allSelectedInGroup} onChange={toggleSelectAll} />
          전체선택
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
