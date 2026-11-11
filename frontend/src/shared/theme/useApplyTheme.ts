import { useEffect } from "react";
import { useThemeStore } from "./themeStore";

const THEME_COLOR_BY_THEME = { dark: "#0B1020", light: "#E8EDF4" } as const;

export function useApplyTheme(): void {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", THEME_COLOR_BY_THEME[theme]);
  }, [theme]);
}
