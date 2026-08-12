import { currentYM, formatExperience, monthsBetween } from "../utils/profileDerive";

interface PeriodRangeProps {
  startYM: string;
  endYM: string;
  onChange: (patch: { startYM?: string; endYM?: string }) => void;
  // 옵션 체크박스(예: 재직중). 미지정 시 체크박스 없음.
  current?: boolean;
  onCurrentChange?: (v: boolean) => void;
  currentLabel?: string;
  showDuration?: boolean;
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "").slice(0, 6);
}

// 시작–종료 YYYYMM + (옵션) 진행중 체크박스 + (옵션) 자동 기간. 경력·학력 공용.
export function PeriodRange({
  startYM,
  endYM,
  onChange,
  current,
  onCurrentChange,
  currentLabel = "진행중",
  showDuration,
}: PeriodRangeProps) {
  const hasCurrent = onCurrentChange !== undefined;
  const effectiveEnd = current ? currentYM() : endYM;
  const months = monthsBetween(startYM, effectiveEnd);

  return (
    <div className="period-range">
      <input
        className="period-input"
        inputMode="numeric"
        value={startYM}
        onChange={(e) => onChange({ startYM: onlyDigits(e.target.value) })}
        placeholder="202001"
      />
      <span className="period-dash">–</span>
      <input
        className="period-input"
        inputMode="numeric"
        value={current ? "" : endYM}
        disabled={current}
        onChange={(e) => onChange({ endYM: onlyDigits(e.target.value) })}
        placeholder={current ? currentLabel : "202408"}
      />

      {hasCurrent && (
        <label className="period-current">
          <input
            type="checkbox"
            checked={!!current}
            onChange={(e) => onCurrentChange!(e.target.checked)}
          />
          {currentLabel}
        </label>
      )}

      {showDuration && months > 0 && (
        <span className="period-duration">{formatExperience(months)}</span>
      )}
    </div>
  );
}
