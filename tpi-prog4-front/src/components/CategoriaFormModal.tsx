import { useState, useEffect } from "react";
import type { CategoriaFormData } from "../api/categorias.api";
import type { Categoria } from "../types";

interface Props {
  /** Datos iniciales (modo edición). Null = modo creación. */
  inicial: CategoriaFormData | null;
  /** Si se abre desde "+ Subcategoría", el padre queda fijado aquí. */
  padrePreset: Categoria | null;
  /** Todas las categorías para el selector de padre. */
  categorias: Categoria[];
  /** ID que se está editando (para excluir self + descendientes del selector). */
  editandoId: number | null;
  onGuardar: (data: CategoriaFormData) => void;
  onCancelar: () => void;
  cargando?: boolean;
}

/** Devuelve el conjunto de IDs de la categoría y todos sus descendientes. */
function getDescendantIds(catId: number, all: Categoria[]): Set<number> {
  const ids = new Set<number>([catId]);
  for (const c of all) {
    if (c.padreId === catId) {
      for (const id of getDescendantIds(c.id, all)) ids.add(id);
    }
  }
  return ids;
}

/** Construye la ruta "Padre > Hijo" para mostrarlo en el selector. */
function buildPath(cat: Categoria, all: Categoria[]): string {
  const partes: string[] = [cat.nombre];
  let actual: Categoria | undefined = cat;
  while (actual?.padreId) {
    const padre = all.find(c => c.id === actual!.padreId);
    if (!padre) break;
    partes.unshift(padre.nombre);
    actual = padre;
  }
  return partes.join(" › ");
}

export default function CategoriaFormModal({
  inicial, padrePreset, categorias, editandoId,
  onGuardar, onCancelar, cargando,
}: Props) {
  const [form, setForm] = useState<CategoriaFormData>({
    nombre:      inicial?.nombre      ?? "",
    descripcion: inicial?.descripcion ?? null,
    imagenUrl:   inicial?.imagenUrl   ?? null,
    padreId:     inicial?.padreId     ?? padrePreset?.id ?? null,
  });
  const [error, setError] = useState("");

  // Si cambia la data inicial (p.ej. el usuario abrió editar de otra cat) reseteamos.
  useEffect(() => {
    setForm({
      nombre:      inicial?.nombre      ?? "",
      descripcion: inicial?.descripcion ?? null,
      imagenUrl:   inicial?.imagenUrl   ?? null,
      padreId:     inicial?.padreId     ?? padrePreset?.id ?? null,
    });
    setError("");
  }, [inicial, padrePreset]);

  function handleGuardar() {
    const nombre = form.nombre.trim();
    if (!nombre) { setError("El nombre es obligatorio."); return; }
    onGuardar({
      nombre,
      descripcion: form.descripcion?.trim() || null,
      imagenUrl:   form.imagenUrl?.trim()   || null,
      padreId:     form.padreId,
    });
  }

  // Opciones válidas para el selector de padre:
  // - excluye la categoría que se está editando y sus descendientes (evita ciclos)
  // - excluye las dadas de baja
  const excluidos: Set<number> = editandoId
    ? getDescendantIds(editandoId, categorias)
    : new Set();

  const opcionesPadre = categorias
    .filter(c => !c.eliminadoEn && !excluidos.has(c.id))
    .map(c => ({ cat: c, path: buildPath(c, categorias) }))
    .sort((a, b) => a.path.localeCompare(b.path, "es"));

  const inputCls =
    "w-full bg-gray-50 dark:bg-[#3a3a3c] border border-gray-200 dark:border-[#48484a] " +
    "rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white " +
    "focus:outline-none focus:ring-2 focus:ring-[#007aff]";

  const titulo = editandoId
    ? "Editar categoría"
    : padrePreset
      ? `Nueva subcategoría de "${padrePreset.nombre}"`
      : "Nueva categoría raíz";

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/75 z-50 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-[#3a3a3c]">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{titulo}</h2>
          <button
            onClick={onCancelar}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 w-8 h-8 flex items-center
                       justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#3a3a3c] text-xl leading-none transition-colors"
          >
            &times;
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Nombre <span className="text-[#ff3b30]">*</span>
            </label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => { setForm(f => ({ ...f, nombre: e.target.value })); setError(""); }}
              className={inputCls}
              placeholder="Ej: Pizzas"
              autoFocus
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Descripción <span className="text-xs font-normal text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={form.descripcion ?? ""}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value || null }))}
              className={`${inputCls} resize-none`}
              rows={2}
              placeholder="Descripción opcional..."
            />
          </div>

          {/* Imagen URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Imagen <span className="text-xs font-normal text-gray-400">(URL, opcional)</span>
            </label>
            <input
              type="url"
              value={form.imagenUrl ?? ""}
              onChange={e => setForm(f => ({ ...f, imagenUrl: e.target.value || null }))}
              className={inputCls}
              placeholder="https://..."
            />
          </div>

          {/* Padre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Categoría padre
            </label>
            {padrePreset ? (
              /* Padre fijado (creando hija) — solo informativo */
              <div className="flex items-center gap-2 px-3 py-2.5 bg-[#007aff]/5 dark:bg-[#0a84ff]/10
                              border border-[#007aff]/20 dark:border-[#0a84ff]/20 rounded-xl text-sm text-gray-700 dark:text-gray-300">
                <span>📁</span>
                <span className="font-medium">{padrePreset.nombre}</span>
                <span className="text-xs text-gray-400 ml-auto">(fijado)</span>
              </div>
            ) : (
              <select
                value={form.padreId ?? ""}
                onChange={e => setForm(f => ({ ...f, padreId: e.target.value ? Number(e.target.value) : null }))}
                className={inputCls}
              >
                <option value="">— Sin padre (categoría raíz) —</option>
                {opcionesPadre.map(({ cat, path }) => (
                  <option key={cat.id} value={cat.id}>{path}</option>
                ))}
              </select>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Las categorías sin padre son raíces del árbol.
            </p>
          </div>

          {error && <p className="text-xs text-[#ff3b30] dark:text-[#ff453a]">{error}</p>}
        </div>

        {/* ── Footer ── */}
        <div className="flex gap-3 px-6 py-5 border-t border-gray-100 dark:border-[#3a3a3c]">
          <button
            type="button"
            onClick={onCancelar}
            className="flex-1 py-2.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300
                       dark:border-[#48484a] rounded-xl hover:bg-gray-50 dark:hover:bg-[#3a3a3c] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGuardar}
            disabled={cargando}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-[#007aff] dark:bg-[#0a84ff]
                       hover:opacity-90 rounded-xl disabled:opacity-60 transition-opacity"
          >
            {cargando ? "Guardando..." : "Guardar"}
          </button>
        </div>

      </div>
    </div>
  );
}
