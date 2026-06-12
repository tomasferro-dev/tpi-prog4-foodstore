import { useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { authApi } from "../api/auth.api";
import { useAuthStore } from "../stores/authStore";
import { HttpError } from "../api/mockServer";
import DarkModeToggle from "../components/DarkModeToggle";

export default function RegisterPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const isAuthenticated = useAuthStore((s) => !!s.accessToken && !!s.user);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmar) { setError("Las contrasenas no coinciden"); return; }
    setCargando(true);
    try {
      const res = await authApi.registro({ nombre, email, password });
      login(res);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof HttpError ? err.detail : "Error inesperado al registrarse");
    } finally {
      setCargando(false);
    }
  };

  const fields = [
    { id: "nombre", label: "Nombre completo", type: "text", value: nombre, set: setNombre, placeholder: "Juan Perez", auto: "name" },
    { id: "email", label: "Email", type: "email", value: email, set: setEmail, placeholder: "juan@email.com", auto: "email" },
    { id: "password", label: "Contrasena", type: "password", value: password, set: setPassword, placeholder: "Minimo 6 caracteres", auto: "new-password" },
    { id: "confirmar", label: "Confirmar contrasena", type: "password", value: confirmar, set: setConfirmar, placeholder: "Repeti tu contrasena", auto: "new-password" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f2f2f7] dark:bg-black p-4">
      <div className="absolute top-4 right-4">
        <DarkModeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-1">FoodStore</h1>
          <p className="text-gray-500 dark:text-gray-400">Crear cuenta</p>
        </div>

        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-sm border border-gray-200 dark:border-[#3a3a3c] overflow-hidden">
          <form onSubmit={onSubmit}>
            <div className="divide-y divide-gray-100 dark:divide-[#3a3a3c]">
              {fields.map(({ id, label, type, value, set, placeholder, auto }) => (
                <div key={id} className="px-4 py-3">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    {label}
                  </label>
                  <input
                    id={id} type={type} required
                    minLength={type === "password" ? 6 : undefined}
                    value={value} onChange={(e) => set(e.target.value)}
                    className="w-full bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none text-base"
                    placeholder={placeholder} autoComplete={auto}
                  />
                </div>
              ))}
            </div>

            {error && (
              <div className="mx-4 my-3 bg-red-50 dark:bg-[#ff453a]/10 border border-red-200 dark:border-[#ff453a]/30 text-red-700 dark:text-[#ff453a] text-sm rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            <div className="p-4">
              <button
                type="submit" disabled={cargando}
                className="w-full bg-[#007aff] dark:bg-[#0a84ff] hover:opacity-90 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-opacity text-base"
              >
                {cargando ? "Registrando..." : "Crear cuenta"}
              </button>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Ya tenes cuenta?{" "}
          <Link to="/login" className="text-[#007aff] dark:text-[#0a84ff] font-medium">
            Iniciar sesion
          </Link>
        </p>
      </div>
    </div>
  );
}
