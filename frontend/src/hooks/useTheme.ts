import { useCallback, useEffect, useState } from "react";

// 라이트/다크 테마를 documentElement의 data-theme 속성으로 토글하고 localStorage에 저장한다.
// 저장값이 없으면 OS 설정(prefers-color-scheme)을 초기값으로 사용한다.
const STORAGE_KEY = "theme";
type Theme = "light" | "dark";

function initialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle };
}
