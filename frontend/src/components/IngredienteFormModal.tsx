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

const VACIO: IngredienteFormData = {
  nombre: "",
  descripcion: "",
  esAlergeno: false,
  stockDisponible: 0,
  costoUnitario: 0,
  unidadMedidaId: 0,
};

export default function IngredienteFormModal({ inicial, onGuardar, onCancelar, cargando }: Props) {
  const { data: unidades = [] } = useUnidadesMedidaQuery();
  const [form, setForm] = useState<IngredienteFormData>(VACIO);
  const [errores, setErrores] = useState<Partial<Record<keyof IngredienteFormData, string>>>({});

  useEffect(() => {
    if (inicial) {
      setForm({
        nombre: inicial.nombre,
        descripcion: inicial.descripcion ?? "",
        esAlergeno: inicial.esAlergeno,
        stockDisponible: inicial.stockDisponible,
        costoUnitario: inicial.costoUnitario,
        unidadMedidaId: inicial.unidadMedidaId,
      });
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
    if (form.unidadMedidaId === 0) e.unidadMedidaId = "Seleccioná una unidad de medida.";
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

  const inputCls =
    "w-full bg-gray-50 dark:bg-[#3a3a3c] border border-gray-200 dark:border-[#48484a] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#007aff]";

  const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/75 z-50 flex">
      <div className="bg-white dark:bg-[#1c1c1e] w-full h-full flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#3a3a3c] flex-shrink-0 bg-white dark:bg-[#2c2c2e]">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {inicial ? "Editar insumo" : "Nuevo insumo"}
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Completá los datos del insumo / ingrediente
            </p>
          </div>
          <button
            onClick={onCancelar}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-[#3a3a3c] text-2xl leading-none transition-colors"
          >
            &times;
          </button>
        </div>

        {/* ── Contenido 2 columnas ── */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200 dark:divide-[#3a3a3c]">

          {/* ─── Columna izquierda: Descripción ─── */}
          <div className="overflow-y-auto px-6 py-6 space-y-5">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Identificación
            </p>

            {/* Nombre */}
            <div>
              <label className={labelCls}>Nombre *</label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => cambiar("nombre", e.target.value)}
                className={inputCls}
                placeholder="Ej: Queso mozzarella"
              />
              {errores.nombre && (
                <p className="text-xs text-[#ff3b30] dark:text-[#ff453a] mt-1">{errores.nombre}</p>
              )}
            </div>

            {/* Descripción */}
            <div>
              <label className={labelCls}>Descripción</label>
              <textarea
                value={form.descripcion ?? ""}
                onChange={(e) => cambiar("descripcion", e.target.value)}
                rows={5}
                className={`${inputCls} resize-none`}
                placeholder="Descripción opcional del insumo..."
              />
            </div>

            {/* Es alérgeno */}
            <label className="flex items-center gap-3 cursor-pointer select-none p-4 bg-[#ff9500]/5 dark:bg-[#ff9f0a]/10 border border-[#ff9500]/20 dark:border-[#ff9f0a]/20 rounded-xl">
              <input
                type="checkbox"
                checked={form.esAlergeno}
                onChange={(e) => cambiar("esAlergeno", e.target.checked)}
                className="w-4 h-4 accent-[#ff9500]"
              />
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  ⚠ Es alérgeno
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Se mostrará como advertencia en el catálogo
                </p>
              </div>
            </label>
          </div>

          {/* ─── Columna derecha: Stock y costo ─── */}
          <div className="overflow-y-auto px-6 py-6 space-y-5">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Stock y costos
            </p>

            {/* Unidad de medida */}
            <div>
              <label className={labelCls}>Unidad de medida *</label>
              <select
                value={form.unidadMedidaId}
                onChange={(e) => cambiar("unidadMedidaId", Number(e.target.value))}
                className={inputCls}
              >
                <option
                  value={0}
                  className="bg-gray-50 dark:bg-[#3a3a3c] text-gray-900 dark:text-white"
                >
                  Seleccionar...
                </option>
                {unidades.map((u: UnidadMedida) => (
                  <option
                    key={u.id}
                    value={u.id}
                    className="bg-gray-50 dark:bg-[#3a3a3c] text-gray-900 dark:text-white"
                  >
                    {u.nombre} ({u.simbolo}) — {u.tipo}
                  </option>
                ))}
              </select>
              {errores.unidadMedidaId && (
                <p className="text-xs text-[#ff3b30] dark:text-[#ff453a] mt-1">{errores.unidadMedidaId}</p>
              )}
            </div>

            {/* Stock disponible */}
            <div>
              <label className={labelCls}>
                Stock disponible{unidadSel ? ` (${unidadSel.simbolo})` : ""}
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.stockDisponible}
                onChange={(e) => cambiar("stockDisponible", Number(e.target.value))}
                className={inputCls}
                placeholder="0"
              />
              {errores.stockDisponible && (
                <p className="text-xs text-[#ff3b30] dark:text-[#ff453a] mt-1">{errores.stockDisponible}</p>
              )}
              {unidadSel && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Ingresá la cantidad en {unidadSel.nombre}s que tenés en stock
                </p>
              )}
            </div>

            {/* Costo unitario */}
            <div>
              <label className={labelCls}>
                Costo por {unidadSel ? unidadSel.simbolo : "unidad"} ($)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.costoUnitario}
                onChange={(e) => cambiar("costoUnitario", Number(e.target.value))}
                className={inputCls}
                placeholder="0"
              />
              {errores.costoUnitario && (
                <p className="text-xs text-[#ff3b30] dark:text-[#ff453a] mt-1">{errores.costoUnitario}</p>
              )}
            </div>

            {/* Resumen de costos si hay datos */}
            {form.stockDisponible > 0 && form.costoUnitario > 0 && unidadSel && (
              <div className="p-4 bg-[#007aff]/5 dark:bg-[#0a84ff]/10 border border-[#007aff]/20 dark:border-[#0a84ff]/20 rounded-xl space-y-1">
                <p className="text-xs font-semibold text-[#007aff] dark:text-[#0a84ff]">Resumen</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Stock: <span className="font-semibold">{form.stockDisponible} {unidadSel.simbolo}</span>
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Valor total:{" "}
                  <span className="font-semibold">
                    ${(form.stockDisponible * form.costoUnitario).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-[#3a3a3c] flex-shrink-0 bg-white dark:bg-[#2c2c2e]">
          <button
            type="button"
            onClick={onCancelar}
            className="px-5 py-2.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-[#48484a] rounded-xl hover:bg-gray-50 dark:hover:bg-[#3a3a3c] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={cargando}
            className="px-5 py-2.5 text-sm font-medium text-white bg-[#007aff] dark:bg-[#0a84ff] hover:opacity-90 rounded-xl disabled:opacity-60 transition-opacity"
          >
            {cargando ? "Guardando..." : inicial ? "Guardar cambios" : "Crear insumo"}
          </button>
        </div>
      </div>
    </div>
  );
}
