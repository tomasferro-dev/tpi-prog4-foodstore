import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ThemeState {
  dark: boolean;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      dark: false,
      toggle: () =>
        set((s) => {
          const next = !s.dark;
          document.documentElement.classList.toggle("dark", next);
          return { dark: next };
        }),
    }),
    { name: "food-store-theme-v2" }
  )
);

/** Llamar antes del primer render para evitar flash de tema incorrecto. */
export function initTheme() {
  try {
    const raw = localStorage.getItem("food-store-theme-v2");
    if (raw) {
      const { state } = JSON.parse(raw) as { state: { dark: boolean } };
      document.documentElement.classList.toggle("dark", !!state?.dark);
    }
  } catch {
    // si localStorage falla, quedarse en light mode
  }
}
