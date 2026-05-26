import { useEffect, useMemo, useState } from "react";
import { useIngredientesQuery } from "../hooks/useIngredientes";
import { useUnidadesMedidaQuery } from "../hooks/useUnidadesMedida";
import { useCategoriasQuery } from "../hooks/useCategorias";
import { useConfigQuery } from "../hooks/useConfig";
import type { Categoria, Ingrediente, ProductoFormData, ProductoIngrediente, UnidadMedida } from "../types";

interface Props {
  inicial?: ProductoFormData | null;
  onGuardar: (data: ProductoFormData) => void;
  onCancelar: () => void;
  cargando?: boolean;
}

const FORM_VACIO: ProductoFormData = {
  nombre: "", descripcion: "", imagenUrl: "", precioBase: 0,
  disponible: true, unidadVentaId: null, categoriaIds: [], ingredientes: [],
};

function calcularStock(lineas: ProductoIngrediente[], mapa: Map<number, Ingrediente>): number {
  if (lineas.length === 0) return 0;
  let minimo = Infinity;
  for (const l of lineas) {
    const ing = mapa.get(l.ingredienteId);
    if (!ing || l.cantidad <= 0) continue;
    minimo = Math.min(minimo, Math.floor(ing.stockDisponible / l.cantidad));
  }
  return minimo === Infinity ? 0 : minimo;
}

function calcularPrecioSugerido(lineas: ProductoIngrediente[], mapa: Map<number, Ingrediente>, config: { porcentajeGanancia: number; unidadesMesEstimadas: number; costos: { salario: number; gas: number; luz: number; alquiler: number; otros: number } } | undefined): number {
  if (!config) return 0;
  const costoIng = lineas.reduce((acc, l) => { const ing = mapa.get(l.ingredienteId); return acc + (ing ? ing.costoUnitario * l.cantidad : 0); }, 0);
  const totalOp = Object.values(config.costos).reduce((a, b) => a + b, 0);
  const costoOp = config.unidadesMesEstimadas > 0 ? totalOp / config.unidadesMesEstimadas : 0;
  return (costoIng + costoOp) * (1 + config.porcentajeGanancia / 100);
}

export default function ProductoFormModal({ inicial, onGuardar, onCancelar, cargando }: Props) {
  const { data: ingData } = useIngredientesQuery({ limit: 200 });
  const { data: unidades = [] } = useUnidadesMedidaQuery();
  const { data: categorias = [] } = useCategoriasQuery();
  const { data: config } = useConfigQuery();

  const todosIngredientes: Ingrediente[] = ingData?.items ?? [];
  const mapaIngredientes = useMemo(() => new Map(todosIngredientes.map((i) => [i.id, i])), [todosIngredientes]);

  const [form, setForm] = useState<ProductoFormData>(FORM_VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [seccion, setSeccion] = useState<"info" | "ingredientes">("info");

  useEffect(() => { setForm(inicial ? { ...inicial } : { ...FORM_VACIO }); setErrores({}); }, [inicial]);

  const stockCalculado = useMemo(() => calcularStock(form.ingredientes, mapaIngredientes), [form.ingredientes, mapaIngredientes]);
  const precioSugeridoCalc = useMemo(() => calcularPrecioSugerido(form.ingredientes, mapaIngredientes, config), [form.ingredientes, mapaIngredientes, config]);

  function cambiar<K extends keyof ProductoFormData>(campo: K, valor: ProductoFormData[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: "" }));
  }

  function toggleCategoria(id: number) {
    setForm((f) => ({ ...f, categoriaIds: f.categoriaIds.includes(id) ? f.categoriaIds.filter((c) => c !== id) : [...f.categoriaIds, id] }));
  }

  function agregarLinea() {
    const libre = todosIngredientes.find((i) => !form.ingredientes.some((l) => l.ingredienteId === i.id));
    if (!libre) return;
    setForm((f) => ({ ...f, ingredientes: [...f.ingredientes, { ingredienteId: libre.id, cantidad: 1, unidadMedidaId: libre.unidadMedidaId, esRemovible: false }] }));
  }

  function actualizarLinea(idx: number, patch: Partial<ProductoIngrediente>) {
    setForm((f) => {
      const lineas = [...f.ingredientes];
      lineas[idx] = { ...lineas[idx], ...patch };
      if (patch.ingredienteId !== undefined) {
        const ing = mapaIngredientes.get(patch.ingredienteId);
        if (ing) lineas[idx].unidadMedidaId = ing.unidadMedidaId;
      }
      return { ...f, ingredientes: lineas };
    });
  }

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!form.nombre.trim()) e.nombre = "El nombre es obligatorio.";
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validar()) { setSeccion("info"); return; }
    onGuardar({ ...form, nombre: form.nombre.trim(), descripcion: form.descripcion.trim() });
  }

  const ingUsados = new Set(form.ingredientes.map((l) => l.ingredienteId));
  const inputCls = "w-full bg-gray-50 dark:bg-[#3a3a3c] border border-gray-200 dark:border-[#48484a] rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#007aff]";

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-100 dark:border-[#3a3a3c]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#3a3a3c] flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{inicial ? "Editar producto" : "Nuevo producto"}</h2>
          <button onClick={onCancelar} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#3a3a3c]">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-[#3a3a3c] flex-shrink-0">
          {(["info", "ingredientes"] as const).map((tab) => (
            <button key={tab} onClick={() => setSeccion(tab)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${seccion === tab ? "border-[#007aff] dark:border-[#0a84ff] text-[#007aff] dark:text-[#0a84ff]" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
              {tab === "info" ? "Informacion" : "Ingredientes"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          {seccion === "info" && (
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
                <input type="text" value={form.nombre} onChange={(e) => cambiar("nombre", e.target.value)} className={inputCls} placeholder="Pizza Margherita" />
                {errores.nombre && <p className="text-xs text-[#ff3b30] dark:text-[#ff453a] mt-1">{errores.nombre}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripcion</label>
                <textarea value={form.descripcion} onChange={(e) => cambiar("descripcion", e.target.value)} rows={2} className={`${inputCls} resize-none`} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL de imagen</label>
                <input type="text" value={form.imagenUrl} onChange={(e) => cambiar("imagenUrl", e.target.value)} className={inputCls} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Precio de venta ($)</label>
                  <input type="number" min={0} step="0.01" value={form.precioBase} onChange={(e) => cambiar("precioBase", Number(e.target.value))} className={inputCls} />
                  {precioSugeridoCalc > 0 && (
                    <p className="text-xs text-[#34c759] dark:text-[#30d158] mt-1">Sugerido: ${Math.round(precioSugeridoCalc).toLocaleString("es-AR")}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unidad de venta</label>
                  <select value={form.unidadVentaId ?? ""} onChange={(e) => cambiar("unidadVentaId", e.target.value ? Number(e.target.value) : null)} className={inputCls}>
                    <option value="">Sin especificar</option>
                    {unidades.map((u: UnidadMedida) => <option key={u.id} value={u.id}>{u.nombre} ({u.simbolo})</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.disponible} onChange={(e) => cambiar("disponible", e.target.checked)} className="w-4 h-4 accent-[#007aff]" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Disponible para la venta</span>
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Categorias</label>
                <div className="flex flex-wrap gap-3">
                  {categorias.filter((c: Categoria) => !c.eliminadoEn).map((c: Categoria) => (
                    <label key={c.id} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={form.categoriaIds.includes(c.id)} onChange={() => toggleCategoria(c.id)} className="w-3.5 h-3.5 accent-[#007aff]" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{c.nombre}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {seccion === "ingredientes" && (
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#007aff]/5 dark:bg-[#0a84ff]/10 border border-[#007aff]/15 dark:border-[#0a84ff]/20 rounded-2xl p-3 text-center">
                  <p className="text-xs text-[#007aff] dark:text-[#0a84ff] font-medium mb-0.5">Stock calculado</p>
                  <p className="text-3xl font-bold text-[#007aff] dark:text-[#0a84ff]">{stockCalculado}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">unidades posibles</p>
                </div>
                <div className="bg-[#34c759]/5 dark:bg-[#30d158]/10 border border-[#34c759]/15 dark:border-[#30d158]/20 rounded-2xl p-3 text-center">
                  <p className="text-xs text-[#34c759] dark:text-[#30d158] font-medium mb-0.5">Precio sugerido</p>
                  <p className="text-3xl font-bold text-[#34c759] dark:text-[#30d158]">
                    {precioSugeridoCalc > 0 ? `$${Math.round(precioSugeridoCalc).toLocaleString("es-AR")}` : "-"}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{config ? `${config.porcentajeGanancia}% margen` : "sin config"}</p>
                </div>
              </div>

              {form.ingredientes.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Sin ingredientes. Stock sera 0.</p>
              ) : (
                <div className="border border-gray-100 dark:border-[#3a3a3c] rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-[#3a3a3c]">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Ingrediente</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Cantidad</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Removible</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-[#3a3a3c]">
                      {form.ingredientes.map((linea, idx) => {
                        const ing = mapaIngredientes.get(linea.ingredienteId);
                        const unidad = unidades.find((u: UnidadMedida) => u.id === linea.unidadMedidaId);
                        const stockLinea = ing && linea.cantidad > 0 ? Math.floor(ing.stockDisponible / linea.cantidad) : null;
                        return (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-[#3a3a3c] transition-colors">
                            <td className="px-3 py-2">
                              <select value={linea.ingredienteId}
                                onChange={(e) => actualizarLinea(idx, { ingredienteId: Number(e.target.value) })}
                                className="w-full bg-transparent border border-gray-200 dark:border-[#48484a] rounded-lg px-2 py-1 text-xs text-gray-900 dark:text-white focus:outline-none">
                                {todosIngredientes.filter((i) => !ingUsados.has(i.id) || i.id === linea.ingredienteId).map((i: Ingrediente) => (
                                  <option key={i.id} value={i.id}>{i.nombre}</option>
                                ))}
                              </select>
                              {stockLinea !== null && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">stock para {stockLinea} u.</p>}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1">
                                <input type="number" min={0.01} step="0.01" value={linea.cantidad}
                                  onChange={(e) => actualizarLinea(idx, { cantidad: Number(e.target.value) })}
                                  className="w-20 bg-transparent border border-gray-200 dark:border-[#48484a] rounded-lg px-2 py-1 text-xs text-right text-gray-900 dark:text-white focus:outline-none" />
                                <span className="text-xs text-gray-400 dark:text-gray-500 w-5">{unidad?.simbolo ?? ""}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <input type="checkbox" checked={linea.esRemovible}
                                onChange={(e) => actualizarLinea(idx, { esRemovible: e.target.checked })}
                                className="w-3.5 h-3.5 accent-[#007aff]" />
                            </td>
                            <td className="px-2 py-2">
                              <button type="button" onClick={() => setForm((f) => ({ ...f, ingredientes: f.ingredientes.filter((_, i) => i !== idx) }))}
                                className="text-[#ff3b30] dark:text-[#ff453a] hover:opacity-75 text-lg leading-none">&times;</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <button type="button" onClick={agregarLinea}
                disabled={todosIngredientes.length === 0 || ingUsados.size >= todosIngredientes.length}
                className="w-full py-2.5 border-2 border-dashed border-gray-200 dark:border-[#3a3a3c] rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:border-[#007aff] dark:hover:border-[#0a84ff] hover:text-[#007aff] dark:hover:text-[#0a84ff] transition-colors disabled:opacity-40">
                + Agregar ingrediente
              </button>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100 dark:border-[#3a3a3c] flex-shrink-0">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {form.ingredientes.length > 0 ? `${form.ingredientes.length} ingrediente${form.ingredientes.length > 1 ? "s" : ""} · stock: ${stockCalculado}` : "Sin ingredientes"}
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={onCancelar}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-[#48484a] rounded-xl hover:bg-gray-50 dark:hover:bg-[#3a3a3c] transition-colors">
              Cancelar
            </button>
            <button type="button" onClick={handleSubmit as unknown as React.MouseEventHandler} disabled={cargando}
              className="px-4 py-2 text-sm font-medium text-white bg-[#007aff] dark:bg-[#0a84ff] hover:opacity-90 rounded-xl disabled:opacity-60 transition-opacity">
              {cargando ? "Guardando..." : inicial ? "Guardar cambios" : "Crear producto"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
