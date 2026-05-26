import { useEffect, useState } from "react";
import { useUnidadesMedidaQuery } from "../hooks/useUnidadesMedida";
import type { Ingrediente, UnidadMedida } from "../types";

type IngredienteFormData = Omit<Ingrediente, "id" | "creadoEn" | "actualizadoEn" | "eliminadoEn">;

interface Props {
  inicial?: Ingrediente | null;
  onGuardar: (data: IngredienteFormData) => void;
  onCancelar: () => void;
  cargando?: boolean;
}

const VACIO: IngredienteFormData = { nombre: "", descripcion: "", esAlergeno: false, stockDisponible: 0, costoUnitario: 0, unidadMedidaId: 0 };

export default function IngredienteFormModal({ inicial, onGuardar, onCancelar, cargando }: Props) {
  const { data: unidades = [] } = useUnidadesMedidaQuery();
  const [form, setForm] = useState<IngredienteFormData>(VACIO);
  const [errores, setErrores] = useState<Partial<Record<keyof IngredienteFormData, string>>>({});

  useEffect(() => {
    if (inicial) {
      setForm({ nombre: inicial.nombre, descripcion: inicial.descripcion ?? "", esAlergeno: inicial.esAlergeno, stockDisponible: inicial.stockDisponible, costoUnitario: inicial.costoUnitario, unidadMedidaId: inicial.unidadMedidaId });
    } else {
      setForm({ ...VACIO, unidadMedidaId: unidades[0]?.id ?? 0 });
    }
    setErrores({});
  }, [inicial, unidades]);

  function cambiar<K extends keyof IngredienteFormData>(campo: K, valor: IngredienteFormData[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  function validar(): boolean {
    const e: Partial<Record<keyof IngredienteFormData, string>> = {};
    if (!form.nombre.trim()) e.nombre = "El nombre es obligatorio.";
    if (form.unidadMedidaId === 0) e.unidadMedidaId = "Selecciona una unidad.";
    if (form.stockDisponible < 0) e.stockDisponible = "No puede ser negativo.";
    if (form.costoUnitario < 0) e.costoUnitario = "No puede ser negativo.";
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validar()) return;
    onGuardar({ ...form, nombre: form.nombre.trim(), descripcion: form.descripcion?.trim() || null });
  }

  const unidadSel = unidades.find((u: UnidadMedida) => u.id === form.unidadMedidaId);
  const inputCls = "w-full bg-gray-50 dark:bg-[#3a3a3c] border border-gray-200 dark:border-[#48484a] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#007aff]";

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100 dark:border-[#3a3a3c]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#3a3a3c]">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {inicial ? "Editar insumo" : "Nuevo insumo"}
          </h2>
          <button onClick={onCancelar} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#3a3a3c]">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
            <input type="text" value={form.nombre} onChange={(e) => cambiar("nombre", e.target.value)}
              className={inputCls} placeholder="Ej: Queso mozzarella" />
            {errores.nombre && <p className="text-xs text-[#ff3b30] dark:text-[#ff453a] mt-1">{errores.nombre}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripcion</label>
            <textarea value={form.descripcion ?? ""} onChange={(e) => cambiar("descripcion", e.target.value)}
              rows={2} className={`${inputCls} resize-none`} placeholder="Opcional" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unidad de medida *</label>
            <select value={form.unidadMedidaId} onChange={(e) => cambiar("unidadMedidaId", Number(e.target.value))} className={inputCls}>
              <option value={0}>Seleccionar...</option>
              {unidades.map((u: UnidadMedida) => (
                <option key={u.id} value={u.id}>{u.nombre} ({u.simbolo})</option>
              ))}
            </select>
            {errores.unidadMedidaId && <p className="text-xs text-[#ff3b30] dark:text-[#ff453a] mt-1">{errores.unidadMedidaId}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Stock{unidadSel ? ` (${unidadSel.simbolo})` : ""}
              </label>
              <input type="number" min={0} step="0.01" value={form.stockDisponible}
                onChange={(e) => cambiar("stockDisponible", Number(e.target.value))} className={inputCls} />
              {errores.stockDisponible && <p className="text-xs text-[#ff3b30] dark:text-[#ff453a] mt-1">{errores.stockDisponible}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Costo /{unidadSel ? unidadSel.simbolo : "u"} ($)
              </label>
              <input type="number" min={0} step="0.01" value={form.costoUnitario}
                onChange={(e) => cambiar("costoUnitario", Number(e.target.value))} className={inputCls} />
              {errores.costoUnitario && <p className="text-xs text-[#ff3b30] dark:text-[#ff453a] mt-1">{errores.costoUnitario}</p>}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.esAlergeno} onChange={(e) => cambiar("esAlergeno", e.target.checked)}
              className="w-4 h-4 accent-[#ff9500]" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Es alergeno</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onCancelar}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-[#48484a] rounded-xl hover:bg-gray-50 dark:hover:bg-[#3a3a3c] transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={cargando}
              className="px-4 py-2 text-sm font-medium text-white bg-[#007aff] dark:bg-[#0a84ff] hover:opacity-90 rounded-xl disabled:opacity-60 transition-opacity">
              {cargando ? "Guardando..." : inicial ? "Guardar cambios" : "Crear insumo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
