// PrivateRoute — protege rutas que requieren autenticación y/o rol.
// Sin sesión → redirige a /login con location.state.from.
// Con sesión pero rol incorrecto → guarda destino en sessionStorage, logout, redirige.
// Espera a que Zustand rehidrate desde localStorage antes de decidir
// (evita falso-redirect a /login al volver desde Mercado Pago).

import { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import type { RolNombre } from "../types";
import type { ReactNode } from "react";

export const POST_LOGIN_REDIRECT_KEY = "postLoginRedirect";

interface Props {
  children: ReactNode;
  roles?: RolNombre[];
}

export default function PrivateRoute({ children, roles }: Props) {
  const location = useLocation();

  // Esperar a que Zustand termine de leer localStorage antes de tomar decisiones
  const [hydrated, setHydrated] = useState(
    () => useAuthStore.persist.hasHydrated()
  );
  useEffect(() => {
    if (hydrated) return;
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, [hydrated]);

  const isAuthenticated = useAuthStore((s) => !!s.accessToken && !!s.user);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  if (!hydrated) return null;

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && roles.length > 0) {
    const tieneAlguno = user.roles.some((r) => roles.includes(r));
    if (!tieneAlguno) {
      sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, location.pathname);
      logout();
      return <Navigate to="/login" replace />;
    }
  }

  return <>{children}</>;
}
