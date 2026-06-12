// uiStore (Zustand) — estado de interfaz: tema, sidebar y toasts.
// Solo el tema (dark) se persiste; sidebar y toasts son transitorios.
// Consolida lo que antes vivía en themeStore.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ToastTipo = "success" | "error" | "info";

export interface Toast {
  id: number;
  tipo: ToastTipo;
  mensaje: string;
}

interface UiState {
  dark: boolean;
  sidebarOpen: boolean;
  toasts: Toast[];
  toggleDark: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: number) => void;
}

let toastSeq = 0;

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      dark: false,
      sidebarOpen: false,
      toasts: [],

      toggleDark: () =>
        set((s) => {
          const next = !s.dark;
          document.documentElement.classList.toggle("dark", next);
          return { dark: next };
        }),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

      addToast: (toast) => set((s) => ({ toasts: [...s.toasts, { ...toast, id: ++toastSeq }] })),
      removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      // misma clave que el antiguo themeStore → preserva el tema ya guardado
      name: "food-store-theme-v2",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ dark: state.dark }), // solo el tema persiste
    }
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
