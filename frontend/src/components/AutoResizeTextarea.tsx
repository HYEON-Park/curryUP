import { useEffect, useRef } from "react";

interface AutoResizeTextareaProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}

export function AutoResizeTextarea({ value, onChange, placeholder }: AutoResizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function resize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(resize, [value]);

  return (
    <textarea
      ref={ref}
      rows={4}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{ overflow: "hidden", resize: "none" }}
    />
  );
}
