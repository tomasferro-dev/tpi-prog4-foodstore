import { useEffect, useState } from "react";
import type { DireccionFormData } from "../api/direcciones.api";

interface Props {
  /** Datos iniciales (modo edición). Null = modo creación. */
  inicial: DireccionFormData | null;
  onGuardar: (data: DireccionFormData) => void;
  onCancelar: () => void;
  cargando?: boolean;
}

const VACIO: DireccionFormData = {
  alias: null,
  linea1: "",
  linea2: null,
  ciudad: "",
  provincia: null,
  codigoPostal: null,
  esPrincipal: false,
};

export default function DireccionFormModal({ inicial, onGuardar, onCancelar, cargando }: Props) {
  const [form, setForm] = useState<DireccionFormData>(inicial ?? VACIO);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(inicial ?? VACIO);
    setError("");
  }, [inicial]);

  function set<K extends keyof DireccionFormData>(k: K, v: DireccionFormData[K]) {
    setForm(f => ({ ...f, [k]: v }));
    setError("");
  }

  function handleGuardar() {
    const linea1 = form.linea1.trim();
    const ciudad = form.ciudad.trim();
    if (!linea1) { setError("La dirección (línea 1) es obligatoria."); return; }
    if (!ciudad) { setError("La ciudad es obligatoria."); return; }
    onGuardar({
      alias: form.alias?.trim() || null,
      linea1,
      linea2: form.linea2?.trim() || null,
      ciudad,
      provincia: form.provincia?.trim() || null,
      codigoPostal: form.codigoPostal?.trim() || null,
      esPrincipal: form.esPrincipal,
    });
  }

  const inputCls =
    "w-full bg-gray-50 dark:bg-[#3a3a3c] border border-gray-200 dark:border-[#48484a] " +
    "rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white " +
    "focus:outline-none focus:ring-2 focus:ring-[#007aff]";

  const label = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/75 z-50 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-[#3a3a3c]">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {inicial ? "Editar dirección" : "Nueva dirección"}
          </h2>
          <button
            onClick={onCancelar}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 w-8 h-8 flex items-center
                       justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#3a3a3c] text-xl leading-none transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className={label}>Alias <span className="text-xs font-normal text-gray-400">(opcional)</span></label>
            <input type="text" value={form.alias ?? ""} onChange={e => set("alias", e.target.value || null)}
              className={inputCls} placeholder="Ej: Casa, Trabajo" autoFocus />
          </div>
          <div>
            <label className={label}>Dirección <span className="text-[#ff3b30]">*</span></label>
            <input type="text" value={form.linea1} onChange={e => set("linea1", e.target.value)}
              className={inputCls} placeholder="Calle y número" />
          </div>
          <div>
            <label className={label}>Piso / Depto <span className="text-xs font-normal text-gray-400">(opcional)</span></label>
            <input type="text" value={form.linea2 ?? ""} onChange={e => set("linea2", e.target.value || null)}
              className={inputCls} placeholder="Ej: Piso 3, Depto B" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Ciudad <span className="text-[#ff3b30]">*</span></label>
              <input type="text" value={form.ciudad} onChange={e => set("ciudad", e.target.value)}
                className={inputCls} placeholder="Ciudad" />
            </div>
            <div>
              <label className={label}>Provincia</label>
              <input type="text" value={form.provincia ?? ""} onChange={e => set("provincia", e.target.value || null)}
                className={inputCls} placeholder="Provincia" />
            </div>
          </div>
          <div>
            <label className={label}>Código postal <span className="text-xs font-normal text-gray-400">(opcional)</span></label>
            <input type="text" value={form.codigoPostal ?? ""} onChange={e => set("codigoPostal", e.target.value || null)}
              className={inputCls} placeholder="Ej: 5500" />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={form.esPrincipal} onChange={e => set("esPrincipal", e.target.checked)}
              className="w-4 h-4 accent-[#007aff]" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Usar como dirección predeterminada</span>
          </label>

          {error && <p className="text-xs text-[#ff3b30] dark:text-[#ff453a]">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-5 border-t border-gray-100 dark:border-[#3a3a3c]">
          <button type="button" onClick={onCancelar}
            className="flex-1 py-2.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300
                       dark:border-[#48484a] rounded-xl hover:bg-gray-50 dark:hover:bg-[#3a3a3c] transition-colors">
            Cancelar
          </button>
          <button type="button" onClick={handleGuardar} disabled={cargando}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-[#007aff] dark:bg-[#0a84ff]
                       hover:opacity-90 rounded-xl disabled:opacity-60 transition-opacity">
            {cargando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
