import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import DarkModeToggle from "./DarkModeToggle";
import CarritoIcon from "./CarritoIcon";

export default function Navbar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [menuAbierto, setMenuAbierto] = useState(false);

  const onCerrarSesion = () => {
    setMenuAbierto(false);
    logout();
    navigate("/login", { replace: true });
  };

  const linkClase = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-[#007aff] dark:bg-[#0a84ff] text-white"
        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2c2c2e]"
    }`;

  const esAdminOStock   = user?.roles.some((r) => ["ADMIN", "STOCK"].includes(r));
  const esAdminOPedidos = user?.roles.some((r) => ["ADMIN", "PEDIDOS"].includes(r));
  const esAdmin         = user?.roles.includes("ADMIN");

  // Links visibles segun el rol del usuario. Se definen una sola vez y se
  // reutilizan en el nav de desktop y en el panel desplegable de mobile.
  const links: { to: string; label: string; end?: boolean }[] = [
    { to: "/", label: "Catalogo", end: true },
    ...(user?.roles.includes("CLIENT") ? [{ to: "/mis-pedidos", label: "Mis Pedidos" }] : []),
    ...(esAdmin ? [{ to: "/admin/dashboard", label: "Dashboard" }] : []),
    ...(esAdmin ? [{ to: "/admin/usuarios", label: "Usuarios" }] : []),
    ...(esAdminOPedidos ? [{ to: "/admin/pedidos", label: "Pedidos" }] : []),
    ...(esAdminOStock ? [{ to: "/admin/productos", label: "Productos" }] : []),
    ...(esAdminOStock ? [{ to: "/admin/insumos", label: "Insumos" }] : []),
    ...(esAdmin ? [{ to: "/admin/categorias", label: "Categorías" }] : []),
    ...(esAdmin ? [{ to: "/admin/config", label: "Config" }] : []),
  ];

  const renderLinks = (onClick?: () => void) =>
    links.map((l) => (
      <NavLink key={l.to} to={l.to} className={linkClase} end={l.end} onClick={onClick}>
        {l.label}
      </NavLink>
    ));

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-[#1c1c1e] border-b border-gray-200 dark:border-[#3a3a3c] shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="text-xl font-bold text-gray-900 dark:text-white">
          FoodStore
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {renderLinks()}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden lg:block">
            <DarkModeToggle />
          </div>
          {user?.roles.includes("CLIENT") && <CarritoIcon />}

          <div className="hidden lg:flex items-center gap-3">
            {user ? (
              <>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{user.nombre}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{user.roles.join(", ")}</p>
                </div>
                <button
                  type="button"
                  onClick={onCerrarSesion}
                  className="bg-[#ff3b30] dark:bg-[#ff453a] hover:opacity-90 text-white text-sm font-medium px-3 py-2 rounded-lg transition-opacity"
                >
                  Salir
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="bg-[#007aff] dark:bg-[#0a84ff] hover:opacity-90 text-white text-sm font-medium px-3 py-2 rounded-lg transition-opacity"
              >
                Iniciar sesion
              </Link>
            )}
          </div>

          {/* Boton hamburguesa - solo mobile/tablet */}
          <button
            type="button"
            onClick={() => setMenuAbierto((v) => !v)}
            className="lg:hidden p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2c2c2e] transition-colors"
            aria-label="Menú"
            aria-expanded={menuAbierto}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuAbierto ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Panel desplegable mobile/tablet */}
      {menuAbierto && (
        <div className="lg:hidden border-t border-gray-200 dark:border-[#3a3a3c] px-4 py-3 flex flex-col gap-1">
          {renderLinks(() => setMenuAbierto(false))}

          <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-[#3a3a3c]">
            {user ? (
              <>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{user.nombre}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{user.roles.join(", ")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <DarkModeToggle />
                  <button
                    type="button"
                    onClick={onCerrarSesion}
                    className="bg-[#ff3b30] dark:bg-[#ff453a] hover:opacity-90 text-white text-sm font-medium px-3 py-2 rounded-lg transition-opacity"
                  >
                    Salir
                  </button>
                </div>
              </>
            ) : (
              <>
                <DarkModeToggle />
                <Link
                  to="/login"
                  onClick={() => setMenuAbierto(false)}
                  className="bg-[#007aff] dark:bg-[#0a84ff] hover:opacity-90 text-white text-sm font-medium px-3 py-2 rounded-lg transition-opacity"
                >
                  Iniciar sesion
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
