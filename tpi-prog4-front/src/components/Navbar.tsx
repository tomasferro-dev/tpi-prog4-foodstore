import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import DarkModeToggle from "./DarkModeToggle";

export default function Navbar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const onCerrarSesion = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const linkClase = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-[#007aff] dark:bg-[#0a84ff] text-white"
        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2c2c2e]"
    }`;

  const esAdminOStock = user?.roles.some((r) => ["ADMIN", "STOCK"].includes(r));
  const esAdmin = user?.roles.includes("ADMIN");

  return (
    <header className="bg-white dark:bg-[#1c1c1e] border-b border-gray-200 dark:border-[#3a3a3c] shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="text-xl font-bold text-gray-900 dark:text-white">
          FoodStore
        </Link>

        <nav className="flex items-center gap-1 flex-wrap">
          <NavLink to="/" className={linkClase} end>
            Catalogo
          </NavLink>
          {esAdminOStock && (
            <NavLink to="/admin/productos" className={linkClase}>
              Productos
            </NavLink>
          )}
          {esAdminOStock && (
            <NavLink to="/admin/insumos" className={linkClase}>
              Insumos
            </NavLink>
          )}
          {esAdmin && (
            <NavLink to="/admin/categorias" className={linkClase}>
              Categorías
            </NavLink>
          )}
          {esAdmin && (
            <NavLink to="/admin/config" className={linkClase}>
              Config
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <DarkModeToggle />

          {user ? (
            <>
              <div className="text-right hidden sm:block">
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
      </div>
    </header>
  );
}
