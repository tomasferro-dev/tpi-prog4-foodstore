import { useState } from "react";
import { useIngredientesQuery, useIngredienteMutations } from "../hooks/useIngredientes";
import { useUnidadesMedidaQuery } from "../hooks/useUnidadesMedida";
import { useConfirm } from "../hooks/useConfirm";
import IngredienteFormModal from "../components/IngredienteFormModal";
import type { Ingrediente, UnidadMedida } from "../types";

type IngredienteFormData = Omit<Ingrediente, "id" | "creadoEn" | "actualizadoEn" | "eliminadoEn">;

export default function InsumosAdminPage() {
  const [busqueda, setBusqueda] = useState("");
  const [filtroAlergeno, setFiltroAlergeno] = useState<"" | "si" | "no">("");
  const [mostrarEliminados, setMostrarEliminados] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Ingrediente | null>(null);

  const { confirmar, ConfirmDialog } = useConfirm();

  const filtros = { busqueda: busqueda || undefined, esAlergeno: filtroAlergeno === "si" ? true : filtroAlergeno === "no" ? false : undefined };
  const { data, isLoading, isError } = useIngredientesQuery(filtros);
  const { data: dataEliminados } = useIngredientesQuery({ ...filtros, incluirEliminados: true });
  const { data: unidades = [] } = useUnidadesMedidaQuery();
  const { crear, editar, eliminar, reactivar } = useIngredienteMutations();

  const activos = data?.items ?? [];
  const eliminados = (dataEliminados?.items ?? []).filter((i: Ingrediente) => i.eliminadoEn !== null);

  function unidadDe(id: number): UnidadMedida | undefined {
    return unidades.find((u: UnidadMedida) => u.id === id);
  }

  function cerrarModal() { setModalAbierto(false); setEditando(null); }

  function handleGuardar(data: IngredienteFormData) {
    if (editando) {
      editar.mutate({ id: editando.id, data }, { onSuccess: cerrarModal });
    } else {
      crear.mutate(data, { onSuccess: cerrarModal });
    }
  }

  async function handleEliminar(ing: Ingrediente) {
    const ok = await confirmar({
      titulo: "Eliminar insumo",
      mensaje: `"${ing.nombre}" sera eliminado. Seguira visible en los productos que lo usan hasta que se reconfigure.`,
      labelConfirmar: "Eliminar",
      destructivo: true,
    });
    if (ok) eliminar.mutate(ing.id);
  }

  const inputCls = "w-full bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-[#3a3a3c] rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007aff]";

  return (
    <>
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Insumos</h1>
          <p className="text-gray-500 dark:text-gray-400">Ingredientes con stock y costo por unidad.</p>
        </div>
        <button onClick={() => { setEditando(null); setModalAbierto(true); }}
          className="flex-shrink-0 px-4 py-2 bg-[#007aff] dark:bg-[#0a84ff] hover:opacity-90 text-white text-sm font-medium rounded-xl transition-opacity">
          + Nuevo insumo
        </button>
      </header>

      <div className="bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-[#3a3a3c] rounded-2xl p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Buscar</label>
            <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre del insumo..." className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Alergeno</label>
            <select value={filtroAlergeno} onChange={(e) => setFiltroAlergeno(e.target.value as "" | "si" | "no")} className={inputCls}>
              <option value="">Todos</option>
              <option value="si">Solo alergenos</option>
              <option value="no">Sin alergenos</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="button" onClick={() => { setBusqueda(""); setFiltroAlergeno(""); }}
              className="text-sm text-[#007aff] dark:text-[#0a84ff] hover:opacity-75">
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {isLoading && <p className="text-center text-gray-500 dark:text-gray-400 py-12">Cargando insumos...</p>}
      {isError && <p className="text-center text-[#ff3b30] dark:text-[#ff453a] py-12">Error al cargar los insumos.</p>}

      {!isLoading && !isError && (
        <div className="bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-[#3a3a3c] rounded-2xl shadow-sm overflow-hidden mb-6">
          {activos.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-12">No hay insumos activos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#2c2c2e] border-b border-gray-100 dark:border-[#3a3a3c]">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Insumo</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Unidad</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Stock</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Costo</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Alergeno</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-[#2c2c2e]">
                  {activos.map((ing: Ingrediente) => {
                    const unidad = unidadDe(ing.unidadMedidaId);
                    return (
                      <tr key={ing.id} className="hover:bg-gray-50 dark:hover:bg-[#2c2c2e] transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-white">{ing.nombre}</p>
                          {ing.descripcion && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{ing.descripcion}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {unidad ? `${unidad.nombre} (${unidad.simbolo})` : `#${ing.unidadMedidaId}`}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                          {ing.stockDisponible.toLocaleString("es-AR")}
                          {unidad && <span className="text-gray-400 dark:text-gray-500 ml-1 font-normal">{unidad.simbolo}</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                          ${ing.costoUnitario.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          {unidad && <span className="text-gray-400 dark:text-gray-500 ml-0.5 font-normal text-xs">/{unidad.simbolo}</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {ing.esAlergeno
                            ? <span className="inline-block bg-[#ff9500]/10 text-[#ff9500] text-xs font-semibold px-2 py-0.5 rounded-full">Alergeno</span>
                            : <span className="text-gray-300 dark:text-gray-600">-</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-3">
                            <button onClick={() => { setEditando(ing); setModalAbierto(true); }}
                              className="text-xs text-[#007aff] dark:text-[#0a84ff] hover:opacity-75">Editar</button>
                            <button onClick={() => handleEliminar(ing)}
                              className="text-xs text-[#ff3b30] dark:text-[#ff453a] hover:opacity-75">Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {eliminados.length > 0 && (
        <div className="border border-gray-200 dark:border-[#3a3a3c] rounded-2xl overflow-hidden">
          <button onClick={() => setMostrarEliminados((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-[#2c2c2e] hover:bg-gray-100 dark:hover:bg-[#3a3a3c] transition-colors text-sm text-gray-500 dark:text-gray-400">
            <span>Insumos eliminados ({eliminados.length})</span>
            <span>{mostrarEliminados ? "Ocultar" : "Mostrar"}</span>
          </button>
          {mostrarEliminados && (
            <div className="overflow-x-auto bg-white dark:bg-[#1c1c1e]">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50 dark:divide-[#2c2c2e]">
                  {eliminados.map((ing: Ingrediente) => {
                    const unidad = unidadDe(ing.unidadMedidaId);
                    return (
                      <tr key={ing.id} className="opacity-60">
                        <td className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 line-through">{ing.nombre}</td>
                        <td className="px-4 py-3 text-gray-500">{unidad?.simbolo ?? "-"}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{ing.stockDisponible.toLocaleString("es-AR")}</td>
                        <td className="px-4 py-3 text-right text-gray-500">${ing.costoUnitario.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => reactivar.mutate(ing.id)}
                            className="text-xs text-[#34c759] dark:text-[#30d158] hover:opacity-75">Reactivar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {modalAbierto && (
        <IngredienteFormModal inicial={editando} onGuardar={handleGuardar}
          onCancelar={cerrarModal} cargando={crear.isPending || editar.isPending} />
      )}
    </div>
    {ConfirmDialog}
    </>
  );
}
