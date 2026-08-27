import { useMemo, useState } from "react";
import { ROLE_CATEGORY_GROUPS } from "../data/jobCategoryMeta";

interface JobTitlePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// 사람인 택소노미(jobCategoryMeta)를 재사용하는 직무 선택 팝업.
export function JobTitlePicker({ value, onChange, placeholder = "직무 선택" }: JobTitlePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // 그룹별 전체 직무(대표 + 상세, 중복 제거)
  const groups = useMemo(
    () =>
      ROLE_CATEGORY_GROUPS.map((g) => ({
        name: g.name,
        titles: Array.from(new Set([...g.categories, ...g.detail])),
      })),
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({ name: g.name, titles: g.titles.filter((t) => t.toLowerCase().includes(q)) }))
      .filter((g) => g.titles.length > 0);
  }, [groups, query]);

  function pick(title: string) {
    onChange(title);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="job-title-picker">
      <button type="button" className="job-title-trigger" onClick={() => setOpen(true)}>
        <span className={value ? "" : "placeholder"}>{value || placeholder}</span>
        <span className="search-icon" aria-hidden>🔍</span>
      </button>

      {open && (
        <div className="job-title-modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="job-title-modal"
            role="dialog"
            aria-modal="true"
            aria-label="직무 선택"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="job-title-modal-head">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="직무명 검색 (예: 백엔드, 마케팅, 간호)"
              />
              <button type="button" className="job-title-modal-close" onClick={() => setOpen(false)}>
                닫기
              </button>
            </div>
            <div className="job-title-modal-body">
              {filtered.length === 0 ? (
                <p className="job-title-empty">검색 결과가 없습니다.</p>
              ) : (
                filtered.map((g) => (
                  <div key={g.name} className="job-title-group">
                    <div className="job-title-group-name">{g.name}</div>
                    <div className="job-title-chips">
                      {g.titles.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={t === value ? "job-title-chip selected" : "job-title-chip"}
                          onClick={() => pick(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
