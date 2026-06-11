import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usuariosApi } from "../api/usuarios.api";
import type {
  RolNombre, Usuario, RolPublic, AdminUsuarioCreateRequest, AdminUsuarioUpdateRequest,
} from "../types";

const ROL_COLOR: Record<string, string> = {
  ADMIN:   "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  STOCK:   "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  PEDIDOS: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  CLIENT:  "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const inputCls =
  "w-full bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-[#3a3a3c] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#007aff]";

type FormState = {
  nombre: string;
  apellido: string;
  email: string;
  celular: string;
  password: string;
  roles: Set<RolNombre>;
};

const FORM_INICIAL: FormState = {
  nombre: "", apellido: "", email: "", celular: "", password: "", roles: new Set(),
};

export default function UsuariosAdminPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [editando, setEditando] = useState<Usuario | null>(null);

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ["admin-usuarios"],
    queryFn: usuariosApi.listar,
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: usuariosApi.roles,
  });

  const refrescar = () => qc.invalidateQueries({ queryKey: ["admin-usuarios"] });

  const crearMut = useMutation({
    mutationFn: (data: AdminUsuarioCreateRequest) => usuariosApi.crear(data),
    onSuccess: (nuevo) => {
      refrescar();
      setOkMsg(`Usuario ${nuevo.email} creado correctamente.`);
      setForm(FORM_INICIAL);
    },
    onError: (e: { detail?: string }) =>
      setErrMsg(e?.detail ?? "Error al crear el usuario"),
  });

  const desactivarMut = useMutation({
    mutationFn: (id: number) => usuariosApi.desactivar(id),
    onSuccess: (u) => { refrescar(); setOkMsg(`Usuario ${u.email} dado de baja.`); },
    onError: (e: { detail?: string }) => setErrMsg(e?.detail ?? "Error al dar de baja"),
  });

  const activarMut = useMutation({
    mutationFn: (id: number) => usuariosApi.activar(id),
    onSuccess: (u) => { refrescar(); setOkMsg(`Usuario ${u.email} reactivado.`); },
    onError: (e: { detail?: string }) => setErrMsg(e?.detail ?? "Error al reactivar"),
  });

  const toggleRol = (codigo: RolNombre) =>
    setForm((f) => {
      const roles = new Set(f.roles);
      roles.has(codigo) ? roles.delete(codigo) : roles.add(codigo);
      return { ...f, roles };
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg(null);
    setOkMsg(null);

    if (!form.nombre.trim()) return setErrMsg("El nombre es obligatorio");
    if (!form.email.trim()) return setErrMsg("El email es obligatorio");
    if (form.password.length < 8) return setErrMsg("La contraseña debe tener al menos 8 caracteres");
    if (form.roles.size === 0) return setErrMsg("Asigná al menos un rol");

    crearMut.mutate({
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim() || undefined,
      email: form.email.trim(),
      celular: form.celular.trim() || undefined,
      password: form.password,
      roles: [...form.roles],
    });
  };

  const handleEliminar = (u: Usuario) => {
    setErrMsg(null);
    setOkMsg(null);
    if (window.confirm(`¿Dar de baja a ${u.email}? Podrás reactivarlo luego.`)) {
      desactivarMut.mutate(u.id);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gestión de Usuarios</h1>
        <p className="text-gray-500 dark:text-gray-400">Creá usuarios, asignales roles y revisá los existentes.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario de creación */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-1 bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-[#3a3a3c] rounded-2xl p-5 shadow-sm h-fit space-y-4"
        >
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Nuevo usuario
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
            <input className={inputCls} value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Juan" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Apellido</label>
            <input className={inputCls} value={form.apellido}
              onChange={(e) => setForm((f) => ({ ...f, apellido: e.target.value }))} placeholder="Pérez" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
            <input type="email" className={inputCls} value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="juan@ejemplo.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Celular</label>
            <input className={inputCls} value={form.celular}
              onChange={(e) => setForm((f) => ({ ...f, celular: e.target.value }))} placeholder="Opcional" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña *</label>
            <input type="password" className={inputCls} value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Mínimo 8 caracteres" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Roles *</label>
            <div className="space-y-2">
              {roles.map((rol) => (
                <label key={rol.codigo} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.roles.has(rol.codigo)}
                    onChange={() => toggleRol(rol.codigo)}
                    className="w-4 h-4 accent-[#007aff]"
                  />
                  <span className="font-medium">{rol.nombre}</span>
                  <span className="text-gray-400 dark:text-gray-500">({rol.codigo})</span>
                </label>
              ))}
            </div>
          </div>

          {errMsg && <p className="text-sm text-[#ff3b30] dark:text-[#ff453a]">{errMsg}</p>}
          {okMsg && <p className="text-sm text-[#34c759] dark:text-[#30d158]">{okMsg}</p>}

          <button
            type="submit"
            disabled={crearMut.isPending}
            className="w-full bg-[#007aff] dark:bg-[#0a84ff] hover:opacity-90 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-opacity"
          >
            {crearMut.isPending ? "Creando…" : "Crear usuario"}
          </button>
        </form>

        {/* Lista de usuarios */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-[#3a3a3c] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-[#3a3a3c]">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Usuarios ({usuarios.length})
            </h2>
          </div>

          {isLoading ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-12">Cargando usuarios…</p>
          ) : usuarios.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-12">No hay usuarios.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#3a3a3c] text-gray-500 dark:text-gray-400">
                    <th className="text-left font-medium px-5 py-3">Usuario</th>
                    <th className="text-left font-medium px-5 py-3">Email</th>
                    <th className="text-left font-medium px-5 py-3">Roles</th>
                    <th className="text-left font-medium px-5 py-3">Estado</th>
                    <th className="text-right font-medium px-5 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#2c2c2e]">
                  {usuarios.map((u: Usuario) => (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-[#2c2c2e] transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                        {u.nombre}{u.apellido ? ` ${u.apellido}` : ""}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{u.email}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length === 0 ? (
                            <span className="text-gray-400 dark:text-gray-500 italic text-xs">sin roles</span>
                          ) : (
                            u.roles.map((r) => (
                              <span key={r} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROL_COLOR[r] ?? "bg-gray-100 text-gray-700"}`}>
                                {r}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {u.eliminadoEn ? (
                          <span className="text-[#ff3b30] dark:text-[#ff453a] text-xs font-medium">Inactivo</span>
                        ) : (
                          <span className="text-[#34c759] dark:text-[#30d158] text-xs font-medium">Activo</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => { setErrMsg(null); setOkMsg(null); setEditando(u); }}
                            className="text-[#007aff] dark:text-[#0a84ff] hover:underline text-xs font-semibold"
                          >
                            Editar
                          </button>
                          {u.eliminadoEn ? (
                            <button
                              onClick={() => { setErrMsg(null); setOkMsg(null); activarMut.mutate(u.id); }}
                              disabled={activarMut.isPending}
                              className="text-[#34c759] dark:text-[#30d158] hover:underline text-xs font-semibold disabled:opacity-50"
                            >
                              Activar
                            </button>
                          ) : (
                            <button
                              onClick={() => handleEliminar(u)}
                              disabled={desactivarMut.isPending}
                              className="text-[#ff3b30] dark:text-[#ff453a] hover:underline text-xs font-semibold disabled:opacity-50"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editando && (
        <EditarUsuarioModal
          usuario={editando}
          roles={roles}
          onClose={() => setEditando(null)}
          onSaved={(u) => {
            refrescar();
            setOkMsg(`Usuario ${u.email} actualizado correctamente.`);
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}

// ── Modal de edición ────────────────────────────────────────────────────────

type EditFormState = {
  nombre: string;
  apellido: string;
  email: string;
  celular: string;
  password: string;
  roles: Set<RolNombre>;
};

function EditarUsuarioModal({
  usuario, roles, onClose, onSaved,
}: {
  usuario: Usuario;
  roles: RolPublic[];
  onClose: () => void;
  onSaved: (u: Usuario) => void;
}) {
  const [form, setForm] = useState<EditFormState>({
    nombre: usuario.nombre,
    apellido: usuario.apellido ?? "",
    email: usuario.email,
    celular: usuario.celular ?? "",
    password: "",
    roles: new Set(usuario.roles),
  });
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const editarMut = useMutation({
    mutationFn: (data: AdminUsuarioUpdateRequest) => usuariosApi.actualizar(usuario.id, data),
    onSuccess: onSaved,
    onError: (e: { detail?: string }) => setErrMsg(e?.detail ?? "Error al actualizar el usuario"),
  });

  const toggleRol = (codigo: RolNombre) =>
    setForm((f) => {
      const roles = new Set(f.roles);
      roles.has(codigo) ? roles.delete(codigo) : roles.add(codigo);
      return { ...f, roles };
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg(null);

    if (!form.nombre.trim()) return setErrMsg("El nombre es obligatorio");
    if (!form.email.trim()) return setErrMsg("El email es obligatorio");
    if (form.password && form.password.length < 8)
      return setErrMsg("La contraseña debe tener al menos 8 caracteres");
    if (form.roles.size === 0) return setErrMsg("Asigná al menos un rol");

    editarMut.mutate({
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim() || undefined,
      email: form.email.trim(),
      celular: form.celular.trim() || undefined,
      password: form.password || undefined,
      roles: [...form.roles],
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-[#3a3a3c] rounded-2xl p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Editar usuario</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
          <input className={inputCls} value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Apellido</label>
          <input className={inputCls} value={form.apellido}
            onChange={(e) => setForm((f) => ({ ...f, apellido: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
          <input type="email" className={inputCls} value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Celular</label>
          <input className={inputCls} value={form.celular}
            onChange={(e) => setForm((f) => ({ ...f, celular: e.target.value }))} placeholder="Opcional" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nueva contraseña</label>
          <input type="password" className={inputCls} value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="Dejar vacío para no cambiarla" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Roles *</label>
          <div className="space-y-2">
            {roles.map((rol) => (
              <label key={rol.codigo} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={form.roles.has(rol.codigo)}
                  onChange={() => toggleRol(rol.codigo)}
                  className="w-4 h-4 accent-[#007aff]"
                />
                <span className="font-medium">{rol.nombre}</span>
                <span className="text-gray-400 dark:text-gray-500">({rol.codigo})</span>
              </label>
            ))}
          </div>
        </div>

        {errMsg && <p className="text-sm text-[#ff3b30] dark:text-[#ff453a]">{errMsg}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-gray-100 dark:bg-[#2c2c2e] hover:opacity-90 text-gray-700 dark:text-gray-300 font-semibold py-2.5 rounded-lg transition-opacity"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={editarMut.isPending}
            className="flex-1 bg-[#007aff] dark:bg-[#0a84ff] hover:opacity-90 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-opacity"
          >
            {editarMut.isPending ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
