import type { ReactNode } from "react";

interface FieldLabelProps {
  children: ReactNode;
  required?: boolean;
}

// 필수: 앞에 도트(--req) + 라벨 / 선택: 라벨 + "(선택)"
export function FieldLabel({ children, required }: FieldLabelProps) {
  return (
    <span className="field-label">
      {required && <span className="field-req-dot" aria-hidden />}
      {children}
      {!required && <span className="field-optional">(선택)</span>}
    </span>
  );
}
