import { useState, useMemo } from "react";
import { useCategoriasAdminQuery, useCategoriasMutations } from "../hooks/useCategorias";
import CategoriaFormModal from "../components/CategoriaFormModal";
import type { CategoriaFormData } from "../api/categorias.api";
import type { Categoria } from "../types";

// ── Árbol ───────────────────────────────────────────────────────────────────

interface NodoArbol {
  cat: Categoria;
  depth: number;
  hasChildren: boolean;
}

/**
 * Construye la lista plana en orden de árbol (pre-order).
 * Los nodos colapsados no expanden sus hijos.
 */
function buildFlat(
  cats: Categoria[],
  parentId: number | null,
  depth: number,
  collapsed: Set<number>,
): NodoArbol[] {
  const result: NodoArbol[] = [];
  const hijos = cats.filter(c => c.padreId === parentId);
  for (const cat of hijos) {
    const tieneHijos = cats.some(c => c.padreId === cat.id);
    result.push({ cat, depth, hasChildren: tieneHijos });
    if (tieneHijos && !collapsed.has(cat.id)) {
      result.push(...buildFlat(cats, cat.id, depth + 1, collapsed));
    }
  }
  return result;
}

// ── Estado del modal ─────────────────────────────────────────────────────────

type ModalState =
  | { tipo: "cerrado" }
  | { tipo: "nueva-raiz" }
  | { tipo: "nueva-hija"; padre: Categoria }
  | { tipo: "editar"; cat: Categoria };

// ── Componente principal ─────────────────────────────────────────────────────

export default function CategoriasAdminPage() {
  const [mostrarEliminados, setMostrarEliminados] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<ModalState>({ tipo: "cerrado" });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: categorias = [], isLoading, isError } = useCategoriasAdminQuery(mostrarEliminados);
  const { crear, editar, eliminar, reactivar } = useCategoriasMutations();

  // Filtra por búsqueda (nombre o descripción). Si hay búsqueda activa, muestra todo expandido.
  const catsFiltradas = useMemo(() => {
    if (!busqueda.trim()) return categorias;
    const q = busqueda.toLowerCase();
    return categorias.filter(
      c => c.nombre.toLowerCase().includes(q) || (c.descripcion ?? "").toLowerCase().includes(q),
    );
  }, [categorias, busqueda]);

  // Cuando hay búsqueda activa, ignoramos el estado de collapse y mostramos todo.
  const collapsedEfectivo = busqueda.trim() ? new Set<number>() : collapsed;

  // Árbol plano para renderizar
  const nodos = useMemo(
    () => buildFlat(catsFiltradas, null, 0, collapsedEfectivo),
    [catsFiltradas, collapsedEfectivo],
  );

  // Estadísticas
  const totalActivas  = categorias.filter(c => !c.eliminadoEn).length;
  const totalBaja     = categorias.filter(c =>  c.eliminadoEn).length;
  const totalRaiz     = categorias.filter(c => !c.eliminadoEn && !c.padreId).length;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function toggleCollapse(id: number) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function cerrarModal() { setModal({ tipo: "cerrado" }); }

  function handleGuardar(data: CategoriaFormData) {
    setErrorMsg(null);
    if (modal.tipo === "editar") {
      editar.mutate(
        { id: modal.cat.id, data },
        {
          onSuccess: cerrarModal,
          onError: (e: unknown) => setErrorMsg(extractError(e)),
        },
      );
    } else {
      crear.mutate(data, {
        onSuccess: cerrarModal,
        onError: (e: unknown) => setErrorMsg(extractError(e)),
      });
    }
  }

  function handleEliminar(cat: Categoria) {
    setErrorMsg(null);
    eliminar.mutate(cat.id, {
      onError: (e: unknown) => setErrorMsg(extractError(e)),
    });
  }

  function handleReactivar(id: number) {
    reactivar.mutate(id, {
      onError: (e: unknown) => setErrorMsg(extractError(e)),
    });
  }

  // ── Modal props ───────────────────────────────────────────────────────────

  const modalAbierto = modal.tipo !== "cerrado";
  const modalInicial: CategoriaFormData | null =
    modal.tipo === "editar"
      ? {
          nombre:      modal.cat.nombre,
          descripcion: modal.cat.descripcion ?? null,
          imagenUrl:   modal.cat.imagenUrl   ?? null,
          padreId:     modal.cat.padreId,
        }
      : null;
  const modalPadrePreset: Categoria | null =
    modal.tipo === "nueva-hija" ? modal.padre : null;
  const modalEditandoId: number | null =
    modal.tipo === "editar" ? modal.cat.id : null;

  const cargandoModal =
    crear.isPending || editar.isPending;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">

      {/* Header */}
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Categorías</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            {totalRaiz} raíces · {totalActivas} activas
            {mostrarEliminados && totalBaja > 0 && ` · ${totalBaja} dadas de baja`}
          </p>
        </div>
        <button
          onClick={() => { setModal({ tipo: "nueva-raiz" }); setErrorMsg(null); }}
          className="flex-shrink-0 px-4 py-2 bg-[#007aff] dark:bg-[#0a84ff] hover:opacity-90
                     text-white text-sm font-medium rounded-xl transition-opacity"
        >
          + Nueva raíz
        </button>
      </header>

      {/* Filtros */}
      <div className="bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-[#3a3a3c]
                      rounded-2xl p-4 mb-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar categoría..."
            className="flex-1 bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-[#3a3a3c]
                       rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-[#007aff]"
          />
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300 self-center">
            <input
              type="checkbox"
              checked={mostrarEliminados}
              onChange={e => setMostrarEliminados(e.target.checked)}
              className="w-4 h-4 accent-[#007aff]"
            />
            Incluir dadas de baja
          </label>
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              className="text-sm text-[#007aff] dark:text-[#0a84ff] hover:opacity-75 self-center"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Error global */}
      {errorMsg && (
        <div className="mb-4 px-4 py-3 bg-[#ff3b30]/10 dark:bg-[#ff453a]/10 border border-[#ff3b30]/30
                        dark:border-[#ff453a]/30 rounded-xl text-sm text-[#ff3b30] dark:text-[#ff453a]
                        flex items-start gap-2">
          <span className="flex-shrink-0 mt-0.5">⚠️</span>
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto flex-shrink-0 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Estados */}
      {isLoading && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-16">Cargando categorías...</p>
      )}
      {isError && (
        <p className="text-center text-[#ff3b30] dark:text-[#ff453a] py-16">Error al cargar las categorías.</p>
      )}
      {!isLoading && !isError && nodos.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            {busqueda ? "Sin resultados para la búsqueda." : "No hay categorías aún."}
          </p>
        </div>
      )}

      {/* Árbol */}
      {!isLoading && !isError && nodos.length > 0 && (
        <div className="bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-[#3a3a3c]
                        rounded-2xl shadow-sm overflow-hidden">
          {nodos.map(({ cat, depth, hasChildren }, idx) => (
            <CategoriaRow
              key={cat.id}
              cat={cat}
              depth={depth}
              hasChildren={hasChildren}
              isCollapsed={collapsed.has(cat.id)}
              isLast={idx === nodos.length - 1}
              onToggle={() => toggleCollapse(cat.id)}
              onNuevaHija={() => { setModal({ tipo: "nueva-hija", padre: cat }); setErrorMsg(null); }}
              onEditar={() => { setModal({ tipo: "editar", cat }); setErrorMsg(null); }}
              onEliminar={() => handleEliminar(cat)}
              onReactivar={() => handleReactivar(cat.id)}
              eliminandoPending={eliminar.isPending}
              reactivandoPending={reactivar.isPending}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalAbierto && (
        <CategoriaFormModal
          inicial={modalInicial}
          padrePreset={modalPadrePreset}
          categorias={categorias}
          editandoId={modalEditandoId}
          onGuardar={handleGuardar}
          onCancelar={cerrarModal}
          cargando={cargandoModal}
        />
      )}
    </div>
  );
}

// ── Fila del árbol ───────────────────────────────────────────────────────────

interface RowProps {
  cat: Categoria;
  depth: number;
  hasChildren: boolean;
  isCollapsed: boolean;
  isLast: boolean;
  onToggle: () => void;
  onNuevaHija: () => void;
  onEditar: () => void;
  onEliminar: () => void;
  onReactivar: () => void;
  eliminandoPending: boolean;
  reactivandoPending: boolean;
}

function CategoriaRow({
  cat, depth, hasChildren, isCollapsed, isLast,
  onToggle, onNuevaHija, onEditar, onEliminar, onReactivar,
  eliminandoPending, reactivandoPending,
}: RowProps) {
  const eliminada = cat.eliminadoEn !== null;
  const INDENT = 28; // px por nivel

  // Badge de profundidad
  const depthLabel = depth === 0 ? "Raíz" : depth === 1 ? "Nivel 2" : `Nivel ${depth + 1}`;
  const depthColor =
    depth === 0
      ? "bg-[#007aff]/10 text-[#007aff] dark:text-[#0a84ff]"
      : depth === 1
        ? "bg-[#34c759]/10 text-[#34c759] dark:text-[#30d158]"
        : "bg-[#ff9500]/10 text-[#ff9500] dark:text-[#ff9f0a]";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-colors
        ${!isLast ? "border-b border-gray-100 dark:border-[#2c2c2e]" : ""}
        ${eliminada
          ? "bg-[#ff3b30]/5 dark:bg-[#ff453a]/5 opacity-60"
          : "hover:bg-gray-50 dark:hover:bg-[#2c2c2e]/50"
        }`}
    >
      {/* Indentación + chevron */}
      <div
        className="flex-shrink-0 flex items-center gap-1"
        style={{ paddingLeft: `${depth * INDENT}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={onToggle}
            className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400
                       hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200
                       dark:hover:bg-[#3a3a3c] transition-colors text-xs"
            title={isCollapsed ? "Expandir" : "Colapsar"}
          >
            <span className={`transition-transform duration-150 inline-block ${isCollapsed ? "" : "rotate-90"}`}>
              ▶
            </span>
          </button>
        ) : (
          /* Placeholder para alinear con nodos que sí tienen hijos */
          <span className="w-6 h-6 flex items-center justify-center text-gray-200 dark:text-gray-700 text-xs">
            {depth > 0 ? "└" : ""}
          </span>
        )}
      </div>

      {/* Nombre + descripción */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-sm font-medium truncate ${
              eliminada
                ? "text-gray-400 dark:text-gray-500 line-through"
                : "text-gray-900 dark:text-white"
            }`}
          >
            {cat.nombre}
          </span>
          <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${depthColor}`}>
            {depthLabel}
          </span>
          {eliminada && (
            <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-[#ff3b30]/10
                             text-[#ff3b30] dark:text-[#ff453a] font-medium">
              Dada de baja
            </span>
          )}
        </div>
        {cat.descripcion && (
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
            {cat.descripcion}
          </p>
        )}
      </div>

      {/* Acciones */}
      <div className="flex-shrink-0 flex items-center gap-1.5">
        {!eliminada && (
          <>
            <button
              type="button"
              onClick={onNuevaHija}
              title="Agregar subcategoría"
              className="px-2.5 py-1.5 text-xs font-medium text-[#007aff] dark:text-[#0a84ff]
                         border border-[#007aff]/30 dark:border-[#0a84ff]/30 rounded-lg
                         hover:bg-[#007aff]/10 transition-colors whitespace-nowrap"
            >
              + Sub
            </button>
            <button
              type="button"
              onClick={onEditar}
              title="Editar"
              className="px-2.5 py-1.5 text-xs font-medium text-[#ff9500] dark:text-[#ff9f0a]
                         border border-[#ff9500]/30 dark:border-[#ff9f0a]/30 rounded-lg
                         hover:bg-[#ff9500]/10 transition-colors"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={onEliminar}
              disabled={eliminandoPending}
              title="Dar de baja"
              className="px-2.5 py-1.5 text-xs font-medium text-[#ff3b30] dark:text-[#ff453a]
                         border border-[#ff3b30]/30 dark:border-[#ff453a]/30 rounded-lg
                         hover:bg-[#ff3b30]/10 transition-colors disabled:opacity-50"
            >
              Baja
            </button>
          </>
        )}
        {eliminada && (
          <button
            type="button"
            onClick={onReactivar}
            disabled={reactivandoPending}
            className="px-2.5 py-1.5 text-xs font-medium text-[#34c759] dark:text-[#30d158]
                       border border-[#34c759]/30 dark:border-[#30d158]/30 rounded-lg
                       hover:bg-[#34c759]/10 transition-colors disabled:opacity-50"
          >
            Reactivar
          </button>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractError(e: unknown): string {
  if (typeof e === "object" && e !== null) {
    const detail = (e as Record<string, unknown>).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((d: unknown) => (d as Record<string, string>).msg).join(", ");
  }
  return "Ocurrió un error inesperado.";
}
