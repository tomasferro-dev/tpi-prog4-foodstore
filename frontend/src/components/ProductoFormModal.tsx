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
  disponible: true, tipoProducto: "terminado", unidadVentaId: null,
  categoriaIds: [], ingredientes: [],
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

function calcularPrecioSugerido(
  lineas: ProductoIngrediente[],
  mapa: Map<number, Ingrediente>,
  config: { porcentajeGanancia: number; unidadesMesEstimadas: number; costos: { salario: number; gas: number; luz: number; alquiler: number; otros: number } } | undefined
): number {
  if (!config) return 0;
  const costoIng = lineas.reduce((acc, l) => {
    const ing = mapa.get(l.ingredienteId);
    return acc + (ing ? ing.costoUnitario * l.cantidad : 0);
  }, 0);
  const totalOp = Object.values(config.costos).reduce((a, b) => a + b, 0);
  const costoOp = config.unidadesMesEstimadas > 0 ? totalOp / config.unidadesMesEstimadas : 0;
  return (costoIng + costoOp) * (1 + config.porcentajeGanancia / 100);
}

// ── Combobox con búsqueda ────────────────────────────────────────────────────
function IngredienteCombobox({
  value,
  onChange,
  ingredientes,
  usados,
}: {
  value: number;
  onChange: (id: number) => void;
  ingredientes: Ingrediente[];
  usados: Set<number>;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const seleccionado = ingredientes.find((i) => i.id === value);
  const filtrados = ingredientes.filter(
    (i) =>
      (!usados.has(i.id) || i.id === value) &&
      i.nombre.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative">
      <input
        type="text"
        value={open ? query : (seleccionado?.nombre ?? "")}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Buscar ingrediente..."
        className="w-full bg-gray-50 dark:bg-[#3a3a3c] border border-gray-200 dark:border-[#48484a] rounded-lg px-2 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#007aff]"
      />
      {open && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-[#48484a] rounded-xl shadow-xl max-h-48 overflow-y-auto">
          {filtrados.length === 0 ? (
            <li className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">Sin resultados</li>
          ) : (
            filtrados.map((i) => (
              <li
                key={i.id}
                onMouseDown={(e) => { e.preventDefault(); onChange(i.id); setOpen(false); }}
                className={`px-3 py-2 text-sm cursor-pointer transition-colors text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#3a3a3c] ${i.id === value ? "bg-[#007aff]/10 dark:bg-[#0a84ff]/10 font-medium" : ""}`}
              >
                {i.nombre}
                {i.esAlergeno && (
                  <span className="ml-2 text-xs text-[#ff9500] dark:text-[#ff9f0a]">⚠ alérgeno</span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

// ── Modal principal ──────────────────────────────────────────────────────────
export default function ProductoFormModal({ inicial, onGuardar, onCancelar, cargando }: Props) {
  const { data: ingData } = useIngredientesQuery({ limit: 200 });
  const { data: unidades = [] } = useUnidadesMedidaQuery();
  const { data: categorias = [] } = useCategoriasQuery();
  const { data: config } = useConfigQuery();

  const todosIngredientes: Ingrediente[] = ingData?.items ?? [];
  const mapaIngredientes = useMemo(
    () => new Map(todosIngredientes.map((i) => [i.id, i])),
    [todosIngredientes]
  );

  const [form, setForm] = useState<ProductoFormData>(FORM_VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  // pasoTipo: true = mostrar selección de tipo (solo para productos nuevos)
  const [pasoTipo, setPasoTipo] = useState<boolean>(inicial == null);

  useEffect(() => {
    setForm(inicial ? { ...inicial } : { ...FORM_VACIO });
    setErrores({});
    setDrawerOpen(false);
    setPasoTipo(inicial == null);
  }, [inicial]);

  const stockCalculado = useMemo(
    () => calcularStock(form.ingredientes, mapaIngredientes),
    [form.ingredientes, mapaIngredientes]
  );
  const precioSugeridoCalc = useMemo(
    () => calcularPrecioSugerido(form.ingredientes, mapaIngredientes, config),
    [form.ingredientes, mapaIngredientes, config]
  );

  function cambiar<K extends keyof ProductoFormData>(campo: K, valor: ProductoFormData[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: "" }));
  }

  function toggleCategoria(id: number) {
    setForm((f) => ({
      ...f,
      categoriaIds: f.categoriaIds.includes(id)
        ? f.categoriaIds.filter((c) => c !== id)
        : [...f.categoriaIds, id],
    }));
  }

  function agregarLinea() {
    const libre = todosIngredientes.find(
      (i) => !form.ingredientes.some((l) => l.ingredienteId === i.id)
    );
    if (!libre) return;
    setForm((f) => ({
      ...f,
      ingredientes: [
        ...f.ingredientes,
        { ingredienteId: libre.id, cantidad: 1, unidadMedidaId: libre.unidadMedidaId, esRemovible: false },
      ],
    }));
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
    if (form.tipoProducto === "elaborado" && form.ingredientes.length === 0) {
      e.ingredientes = "Debés agregar al menos un ingrediente.";
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validar()) return;
    onGuardar({ ...form, nombre: form.nombre.trim(), descripcion: form.descripcion.trim() });
  }

  const ingUsados = new Set(form.ingredientes.map((l) => l.ingredienteId));

  const inputCls =
    "w-full bg-gray-50 dark:bg-[#3a3a3c] border border-gray-200 dark:border-[#48484a] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#007aff]";
  const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  // ── Paso 0: selección de tipo (solo productos nuevos) ──────────────────────
  if (pasoTipo) {
    return (
      <div className="fixed inset-0 bg-black/60 dark:bg-black/75 z-50 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-8 pb-5">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Nuevo producto</h2>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1.5">
              ¿Qué tipo de producto es? Esto define cómo se gestiona el stock y los ingredientes.
            </p>
          </div>

          {/* Cards de tipo */}
          <div className="px-8 pb-6 grid grid-cols-2 gap-4">
            {/* Elaborado */}
            <button
              type="button"
              onClick={() => { cambiar("tipoProducto", "elaborado"); setPasoTipo(false); }}
              className="flex flex-col items-center text-center p-6 rounded-2xl border-2 border-[#007aff]/30 dark:border-[#0a84ff]/30 hover:border-[#007aff] dark:hover:border-[#0a84ff] hover:bg-[#007aff]/5 dark:hover:bg-[#0a84ff]/10 transition-all"
            >
              <span className="text-4xl mb-3">🍳</span>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Elaborado</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Se fabrica a partir de ingredientes. El stock y el costo se calculan automáticamente.
                Requiere al menos un ingrediente.
              </p>
            </button>

            {/* Terminado */}
            <button
              type="button"
              onClick={() => { cambiar("tipoProducto", "terminado"); setPasoTipo(false); }}
              className="flex flex-col items-center text-center p-6 rounded-2xl border-2 border-gray-200 dark:border-[#3a3a3c] hover:border-[#007aff] dark:hover:border-[#0a84ff] hover:bg-gray-50 dark:hover:bg-[#2c2c2e] transition-all"
            >
              <span className="text-4xl mb-3">📦</span>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Terminado</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Producto listo para la venta (ej: bebidas, snacks). El stock se gestiona manualmente.
              </p>
            </button>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 border-t border-gray-100 dark:border-[#3a3a3c] flex justify-end">
            <button
              type="button"
              onClick={onCancelar}
              className="px-5 py-2.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-[#48484a] rounded-xl hover:bg-gray-50 dark:hover:bg-[#3a3a3c] transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulario principal ───────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/75 z-50 flex">
      {/* Contenedor principal (pantalla completa) */}
      <div className="bg-white dark:bg-[#1c1c1e] w-full h-full flex flex-col relative overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#3a3a3c] flex-shrink-0 bg-white dark:bg-[#2c2c2e]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {inicial ? "Editar producto" : "Nuevo producto"}
              </h2>
              {/* Badge de tipo */}
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                form.tipoProducto === "elaborado"
                  ? "bg-[#ff9500]/10 text-[#ff9500] dark:text-[#ff9f0a]"
                  : "bg-[#34c759]/10 text-[#34c759] dark:text-[#30d158]"
              }`}>
                {form.tipoProducto === "elaborado" ? "🍳 Elaborado" : "📦 Terminado"}
              </span>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Completá la información del producto
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Botón hamburguesa → solo para productos elaborados */}
            {form.tipoProducto === "elaborado" && (
              <button
                type="button"
                onClick={() => setDrawerOpen((o) => !o)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all
                  ${drawerOpen
                    ? "bg-[#007aff] dark:bg-[#0a84ff] border-[#007aff] dark:border-[#0a84ff] text-white"
                    : errores.ingredientes
                      ? "bg-[#ff3b30]/5 dark:bg-[#ff453a]/10 border-[#ff3b30] dark:border-[#ff453a] text-[#ff3b30] dark:text-[#ff453a]"
                      : "bg-white dark:bg-[#3a3a3c] border-gray-200 dark:border-[#48484a] text-gray-700 dark:text-gray-300 hover:border-[#007aff] dark:hover:border-[#0a84ff]"
                  }`}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                  <rect y="2"  width="16" height="2" rx="1" fill="currentColor"/>
                  <rect y="7"  width="16" height="2" rx="1" fill="currentColor"/>
                  <rect y="12" width="16" height="2" rx="1" fill="currentColor"/>
                </svg>
                Ingredientes
                {form.ingredientes.length > 0 ? (
                  <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center
                    ${drawerOpen ? "bg-white/30 text-white" : "bg-[#007aff] dark:bg-[#0a84ff] text-white"}`}>
                    {form.ingredientes.length}
                  </span>
                ) : errores.ingredientes ? (
                  <span className="text-xs font-bold">!</span>
                ) : null}
              </button>
            )}

            {/* Cerrar modal */}
            <button
              onClick={onCancelar}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-[#3a3a3c] text-2xl leading-none transition-colors"
            >
              &times;
            </button>
          </div>
        </div>

        {/* ── Form: 2 columnas ── */}
        <div className="flex-1 overflow-y-auto">
          <form
            onSubmit={handleSubmit}
            className="h-full grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200 dark:divide-[#3a3a3c]"
          >
            {/* ─── Columna izquierda ─── */}
            <div className="px-6 py-6 space-y-5">
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
                  placeholder="Ej: Pizza Margherita"
                />
                {errores.nombre && (
                  <p className="text-xs text-[#ff3b30] dark:text-[#ff453a] mt-1">{errores.nombre}</p>
                )}
              </div>

              {/* Descripción */}
              <div>
                <label className={labelCls}>Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => cambiar("descripcion", e.target.value)}
                  rows={4}
                  className={`${inputCls} resize-none`}
                  placeholder="Descripción breve del producto..."
                />
              </div>

              {/* URL imagen + preview */}
              <div>
                <label className={labelCls}>URL de imagen</label>
                <input
                  type="text"
                  value={form.imagenUrl}
                  onChange={(e) => cambiar("imagenUrl", e.target.value)}
                  className={inputCls}
                  placeholder="https://..."
                />
                {form.imagenUrl && (
                  <img
                    src={form.imagenUrl}
                    alt="preview"
                    className="mt-2 h-32 w-full object-cover rounded-xl border border-gray-200 dark:border-[#3a3a3c]"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                    onLoad={(e) => (e.currentTarget.style.display = "block")}
                  />
                )}
              </div>
            </div>

            {/* ─── Columna derecha ─── */}
            <div className="px-6 py-6 space-y-5">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                Precio y disponibilidad
              </p>

              {/* Precio + Unidad de venta */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Precio de venta ($)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.precioBase}
                    onChange={(e) => cambiar("precioBase", Number(e.target.value))}
                    className={inputCls}
                  />
                  {form.tipoProducto === "elaborado" && precioSugeridoCalc > 0 && (
                    <p className="text-xs text-[#34c759] dark:text-[#30d158] mt-1">
                      Sugerido: ${Math.round(precioSugeridoCalc).toLocaleString("es-AR")}
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Unidad de venta</label>
                  <select
                    value={form.unidadVentaId ?? ""}
                    onChange={(e) => cambiar("unidadVentaId", e.target.value ? Number(e.target.value) : null)}
                    className={inputCls}
                  >
                    <option value="" className="bg-gray-50 dark:bg-[#3a3a3c] text-gray-900 dark:text-white">
                      Sin especificar
                    </option>
                    {unidades.map((u: UnidadMedida) => (
                      <option key={u.id} value={u.id} className="bg-gray-50 dark:bg-[#3a3a3c] text-gray-900 dark:text-white">
                        {u.nombre} ({u.simbolo})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Disponible */}
              <label className="flex items-center gap-3 cursor-pointer select-none p-3.5 bg-gray-50 dark:bg-[#2c2c2e] rounded-xl border border-gray-200 dark:border-[#3a3a3c] hover:border-[#007aff]/40 transition-colors">
                <input
                  type="checkbox"
                  checked={form.disponible}
                  onChange={(e) => cambiar("disponible", e.target.checked)}
                  className="w-4 h-4 accent-[#007aff]"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Disponible para la venta</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Aparecerá en el catálogo público</p>
                </div>
              </label>

              {/* Categorías */}
              <div>
                <label className={labelCls}>Categorías</label>
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-[#2c2c2e] rounded-xl border border-gray-200 dark:border-[#3a3a3c] min-h-[52px]">
                  {categorias
                    .filter((c: Categoria) => !c.eliminadoEn)
                    .map((c: Categoria) => (
                      <label
                        key={c.id}
                        className={`flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-lg border text-sm transition-all
                          ${form.categoriaIds.includes(c.id)
                            ? "bg-[#007aff] dark:bg-[#0a84ff] border-[#007aff] dark:border-[#0a84ff] text-white shadow-sm"
                            : "bg-white dark:bg-[#3a3a3c] border-gray-200 dark:border-[#48484a] text-gray-700 dark:text-gray-300 hover:border-[#007aff]/60"
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={form.categoriaIds.includes(c.id)}
                          onChange={() => toggleCategoria(c.id)}
                          className="hidden"
                        />
                        {c.nombre}
                      </label>
                    ))}
                  {categorias.filter((c: Categoria) => !c.eliminadoEn).length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">Sin categorías disponibles</p>
                  )}
                </div>
              </div>

              {/* Mini indicador de ingredientes — solo para elaborados */}
              {form.tipoProducto === "elaborado" && (
                <>
                  {form.ingredientes.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setDrawerOpen(true)}
                      className="w-full flex items-center justify-between p-3.5 bg-[#007aff]/5 dark:bg-[#0a84ff]/10 border border-[#007aff]/20 dark:border-[#0a84ff]/20 rounded-xl hover:border-[#007aff]/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[#007aff] dark:text-[#0a84ff] font-bold text-lg">{form.ingredientes.length}</span>
                        <span className="text-sm text-[#007aff] dark:text-[#0a84ff]">
                          ingrediente{form.ingredientes.length > 1 ? "s" : ""} · stock: {stockCalculado} u.
                        </span>
                      </div>
                      <span className="text-xs text-[#007aff] dark:text-[#0a84ff]">Ver →</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDrawerOpen(true)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-colors ${
                        errores.ingredientes
                          ? "bg-[#ff3b30]/5 dark:bg-[#ff453a]/10 border-[#ff3b30]/40 dark:border-[#ff453a]/40"
                          : "bg-gray-50 dark:bg-[#2c2c2e] border-gray-200 dark:border-[#3a3a3c] hover:border-[#007aff]/50"
                      }`}
                    >
                      <span className={`text-sm ${errores.ingredientes ? "text-[#ff3b30] dark:text-[#ff453a]" : "text-gray-500 dark:text-gray-400"}`}>
                        {errores.ingredientes ? `⚠ ${errores.ingredientes}` : "+ Agregar ingredientes"}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">Abrir →</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </form>
        </div>

        {/* ── Footer ── */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 dark:border-[#3a3a3c] flex-shrink-0 bg-white dark:bg-[#2c2c2e]">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {form.tipoProducto === "elaborado"
              ? form.ingredientes.length > 0
                ? `${form.ingredientes.length} ingrediente${form.ingredientes.length > 1 ? "s" : ""} · stock estimado: ${stockCalculado} u.`
                : "⚠ Sin ingredientes — requeridos para productos elaborados"
              : "📦 Producto terminado · stock gestionado manualmente"}
          </p>
          <div className="flex gap-3">
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
              {cargando ? "Guardando..." : inicial ? "Guardar cambios" : "Crear producto"}
            </button>
          </div>
        </div>

        {/* ── Backdrop del drawer ── */}
        <div
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          style={{ zIndex: 10 }}
        />

        {/* ── Drawer de ingredientes (solo elaborados) ── */}
        <div
          className="absolute top-0 right-0 h-full w-full sm:w-[460px] bg-white dark:bg-[#2c2c2e] shadow-2xl flex flex-col transition-transform duration-300 ease-in-out border-l border-gray-200 dark:border-[#3a3a3c]"
          style={{ zIndex: 20, transform: drawerOpen ? "translateX(0)" : "translateX(100%)" }}
        >
          {/* Header del drawer */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[#3a3a3c] flex-shrink-0">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Ingredientes</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {form.ingredientes.length === 0
                  ? "Sin ingredientes — este producto los requiere"
                  : `${form.ingredientes.length} ingrediente${form.ingredientes.length > 1 ? "s" : ""} · stock: ${stockCalculado} u.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-[#3a3a3c] text-2xl leading-none transition-colors"
            >
              &times;
            </button>
          </div>

          {/* Contenido del drawer */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            {/* Tarjetas métricas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#007aff]/5 dark:bg-[#0a84ff]/10 border border-[#007aff]/20 dark:border-[#0a84ff]/20 rounded-2xl p-3 text-center">
                <p className="text-xs text-[#007aff] dark:text-[#0a84ff] font-semibold mb-1">Stock calculado</p>
                <p className="text-3xl font-bold text-[#007aff] dark:text-[#0a84ff]">{stockCalculado}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">unidades posibles</p>
              </div>
              <div className="bg-[#34c759]/5 dark:bg-[#30d158]/10 border border-[#34c759]/20 dark:border-[#30d158]/20 rounded-2xl p-3 text-center">
                <p className="text-xs text-[#34c759] dark:text-[#30d158] font-semibold mb-1">Precio sugerido</p>
                <p className="text-xl font-bold text-[#34c759] dark:text-[#30d158]">
                  {precioSugeridoCalc > 0 ? `$${Math.round(precioSugeridoCalc).toLocaleString("es-AR")}` : "—"}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {config ? `${config.porcentajeGanancia}% margen` : "sin config"}
                </p>
              </div>
            </div>

            {/* Lista de ingredientes */}
            {form.ingredientes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-[#ff3b30]/30 dark:border-[#ff453a]/30 rounded-2xl bg-[#ff3b30]/5 dark:bg-[#ff453a]/10">
                <p className="text-4xl mb-3">🧂</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Sin ingredientes</p>
                <p className="text-xs text-[#ff3b30] dark:text-[#ff453a] mt-1 font-medium">
                  ⚠ Este producto elaborado requiere al menos uno
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Cabecera columnas */}
                <div className="grid grid-cols-[1fr_90px_52px_28px] gap-2 px-1">
                  <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">Ingrediente</span>
                  <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 text-right">Cantidad</span>
                  <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 text-center">Remov.</span>
                  <span />
                </div>

                {form.ingredientes.map((linea, idx) => {
                  const ing = mapaIngredientes.get(linea.ingredienteId);
                  const unidad = unidades.find((u: UnidadMedida) => u.id === linea.unidadMedidaId);
                  const stockLinea =
                    ing && linea.cantidad > 0 ? Math.floor(ing.stockDisponible / linea.cantidad) : null;

                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-[1fr_90px_52px_28px] gap-2 items-start bg-gray-50 dark:bg-[#3a3a3c] border border-gray-200 dark:border-[#48484a] rounded-xl p-2"
                    >
                      {/* Combobox */}
                      <div>
                        <IngredienteCombobox
                          value={linea.ingredienteId}
                          onChange={(id) => actualizarLinea(idx, { ingredienteId: id })}
                          ingredientes={todosIngredientes}
                          usados={ingUsados}
                        />
                        {stockLinea !== null && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 px-1">
                            stock: {stockLinea} u.
                          </p>
                        )}
                      </div>

                      {/* Cantidad */}
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0.01}
                          step="0.01"
                          value={linea.cantidad}
                          onChange={(e) => actualizarLinea(idx, { cantidad: Number(e.target.value) })}
                          className="w-full bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-[#48484a] rounded-lg px-2 py-1.5 text-sm text-right text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                        />
                        <span className="text-xs text-gray-400 dark:text-gray-500 w-5 shrink-0">
                          {unidad?.simbolo ?? ""}
                        </span>
                      </div>

                      {/* Removible */}
                      <div className="flex items-center justify-center pt-2">
                        <input
                          type="checkbox"
                          checked={linea.esRemovible}
                          onChange={(e) => actualizarLinea(idx, { esRemovible: e.target.checked })}
                          className="w-4 h-4 accent-[#007aff]"
                        />
                      </div>

                      {/* Eliminar */}
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            ingredientes: f.ingredientes.filter((_, i) => i !== idx),
                          }))
                        }
                        className="flex items-center justify-center pt-2 text-[#ff3b30] dark:text-[#ff453a] hover:opacity-75 text-lg leading-none"
                      >
                        &times;
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Botón agregar */}
            <button
              type="button"
              onClick={agregarLinea}
              disabled={todosIngredientes.length === 0 || ingUsados.size >= todosIngredientes.length}
              className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-[#48484a] rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:border-[#007aff] dark:hover:border-[#0a84ff] hover:text-[#007aff] dark:hover:text-[#0a84ff] transition-colors disabled:opacity-40"
            >
              + Agregar ingrediente
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
