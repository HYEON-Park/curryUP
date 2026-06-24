import { useState } from "react";
import { REGIONS } from "../data/regions";

interface LocationPickerProps {
  value: string[];
  onChange: (next: string[]) => void;
}

const NO_DISTRICT = "전체";

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [sido, setSido] = useState("");
  const [sigungu, setSigungu] = useState("");

  const districts = REGIONS.find((r) => r.name === sido)?.districts ?? [];

  function handleAdd() {
    if (!sido) return;
    const label = sigungu && sigungu !== NO_DISTRICT ? `${sido} ${sigungu}` : sido;
    if (value.includes(label)) return;
    onChange([...value, label]);
    setSigungu("");
  }

  function removeLocation(label: string) {
    onChange(value.filter((v) => v !== label));
  }

  return (
    <div className="location-picker">
      <div className="location-picker-controls">
        <select
          value={sido}
          onChange={(e) => {
            setSido(e.target.value);
            setSigungu("");
          }}
        >
          <option value="">시/도 선택</option>
          {REGIONS.map((r) => (
            <option key={r.name} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>

        <select value={sigungu} onChange={(e) => setSigungu(e.target.value)} disabled={!sido}>
          <option value="">시/군/구 (선택 안 해도 됨)</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <button type="button" onClick={handleAdd} disabled={!sido}>
          추가
        </button>
      </div>

      {value.length > 0 && (
        <div className="location-chips">
          {value.map((label) => (
            <span key={label} className="location-chip">
              {label}
              <button type="button" aria-label={`${label} 삭제`} onClick={() => removeLocation(label)}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
