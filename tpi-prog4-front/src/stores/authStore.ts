// authStore (Zustand) — estado de autenticación del cliente.
// Persiste accessToken, refreshToken y usuario en localStorage.
// Logout automático si el token expiró mientras el usuario no estaba.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { jwtDecode } from "jwt-decode";
import type { JwtPayload, LoginResponse, RolNombre, Usuario } from "../types";

function tokenVigente(token: string | null): boolean {
  if (!token) return false;
  try {
    const { exp } = jwtDecode<JwtPayload>(token);
    return exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: Usuario | null;
  login: (data: LoginResponse) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  hasRole: (rol: RolNombre) => boolean;
  hasAnyRole: (roles: RolNombre[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,

      login: (data) =>
        set({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user }),

      logout: () => set({ accessToken: null, refreshToken: null, user: null }),

      isAuthenticated: () => {
        const { accessToken, user } = get();
        return !!user && tokenVigente(accessToken);
      },

      hasRole: (rol) => !!get().user?.roles.includes(rol),
      hasAnyRole: (roles) => !!get().user?.roles.some((r) => roles.includes(r)),
    }),
    {
      name: "food-store-auth-v2",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && !tokenVigente(state.accessToken)) {
          state.logout();
        }
      },
    }
  )
);
