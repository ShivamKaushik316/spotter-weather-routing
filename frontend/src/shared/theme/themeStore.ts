import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemeName } from "@/shared/config/mapStyles";
import { createSafeLocalStorage } from "@/shared/lib/safeStorage";

interface ThemeState {
  theme: ThemeName;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = "night-dispatch-theme";

function systemPreferredTheme(): ThemeName {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: systemPreferredTheme(),
      toggleTheme: () => set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
    }),
    {
      name: THEME_STORAGE_KEY,
      storage: createSafeLocalStorage<Pick<ThemeState, "theme">>(),
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
);
