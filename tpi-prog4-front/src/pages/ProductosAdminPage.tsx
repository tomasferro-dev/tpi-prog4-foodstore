import { useState } from "react";
import { useProductosQuery, useProductoMutations, useProductoDetalleQuery } from "../hooks/useProductos";
import { useCategoriasQuery } from "../hooks/useCategorias";
import { useUnidadesMedidaQuery } from "../hooks/useUnidadesMedida";
import ProductoCard from "../components/ProductoCard";
import ProductoFormModal from "../components/ProductoFormModal";
import StockAjusteModal from "../components/StockAjusteModal";
import Pagination from "../components/Pagination";
import type { Categoria, Producto, ProductoFormData } from "../types";

const ITEMS_POR_PAGINA = 8;

export default function ProductosAdminPage() {
  const [busqueda, setBusqueda] = useState("");
  const [categoriaId, setCategoriaId] = useState<number | undefined>();
  const [skip, setSkip] = useState(0);
  const [mostrarEliminados, setMostrarEliminados] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [stockProducto, setStockProducto] = useState<Producto | null>(null);

  const filtros = { busqueda: busqueda || undefined, categoriaId, incluirEliminados: mostrarEliminados, skip, limit: ITEMS_POR_PAGINA };
  const { data, isLoading, isError } = useProductosQuery(filtros);
  const { data: categorias = [] } = useCategoriasQuery();
  const { data: unidades = [] } = useUnidadesMedidaQuery();
  const { crear, editar, eliminar, reactivar, ajustarStock } = useProductoMutations();
  const { data: editandoDetalle, isLoading: cargandoDetalle } = useProductoDetalleQuery(editandoId);

  const productos = data?.items ?? [];

  function cerrarModal() { setModalAbierto(false); setEditandoId(null); }

  function handleGuardar(formData: ProductoFormData) {
    if (editandoId) {
      editar.mutate({ id: editandoId, data: formData }, { onSuccess: cerrarModal });
    } else {
      crear.mutate(formData, { onSuccess: cerrarModal });
    }
  }

  const inputCls = "w-full bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-[#3a3a3c] rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007aff]";

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Productos</h1>
          <p className="text-gray-500 dark:text-gray-400">Stock calculado desde insumos · Precio sugerido con margen.</p>
        </div>
        <button onClick={() => { setEditandoId(null); setModalAbierto(true); }}
          className="flex-shrink-0 px-4 py-2 bg-[#007aff] dark:bg-[#0a84ff] hover:opacity-90 text-white text-sm font-medium rounded-xl transition-opacity">
          + Nuevo producto
        </button>
      </header>

      <div className="bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-[#3a3a3c] rounded-2xl p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Buscar</label>
            <input type="text" value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setSkip(0); }}
              placeholder="Nombre..." className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Categoria</label>
            <select value={categoriaId ?? ""} onChange={(e) => { setCategoriaId(e.target.value ? Number(e.target.value) : undefined); setSkip(0); }} className={inputCls}>
              <option value="">Todas</option>
              {categorias.filter((c: Categoria) => !c.eliminadoEn).map((c: Categoria) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={mostrarEliminados}
                onChange={(e) => { setMostrarEliminados(e.target.checked); setSkip(0); }}
                className="w-4 h-4 accent-[#007aff]" />
              Incluir dados de baja
            </label>
          </div>
          <div className="flex items-end">
            <button type="button" onClick={() => { setBusqueda(""); setCategoriaId(undefined); setMostrarEliminados(false); setSkip(0); }}
              className="text-sm text-[#007aff] dark:text-[#0a84ff] hover:opacity-75">
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {isLoading && <p className="text-center text-gray-500 dark:text-gray-400 py-12">Cargando productos...</p>}
      {isError && <p className="text-center text-[#ff3b30] dark:text-[#ff453a] py-12">Error al cargar los productos.</p>}
      {!isLoading && !isError && productos.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-12">No se encontraron productos.</p>
      )}

      {!isLoading && productos.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            {productos.map((p: Producto) => (
              <ProductoCard key={p.id} producto={p} categorias={categorias} unidades={unidades} esAdmin={true}
                onEditar={(p) => { setEditandoId(p.id); setModalAbierto(true); }}
                onAjustarStock={(p) => setStockProducto(p)}
                onEliminar={(p) => confirm(`Dar de baja "${p.nombre}"?`) && eliminar.mutate(p.id)}
                onReactivar={(p) => reactivar.mutate(p.id)} />
            ))}
          </div>
          {data && <Pagination total={data.total} skip={data.skip} limit={data.limit} onCambioPagina={setSkip} />}
        </>
      )}

      {modalAbierto && (
        <ProductoFormModal
          inicial={editandoDetalle
            ? { nombre: editandoDetalle.nombre, descripcion: editandoDetalle.descripcion, imagenUrl: editandoDetalle.imagenUrl, precioBase: editandoDetalle.precioBase, disponible: editandoDetalle.disponible, tipoProducto: editandoDetalle.tipoProducto, unidadVentaId: editandoDetalle.unidadVentaId, categoriaIds: editandoDetalle.categoriaIds, ingredientes: editandoDetalle.ingredientes }
            : null}
          onGuardar={handleGuardar} onCancelar={cerrarModal}
          cargando={crear.isPending || editar.isPending || cargandoDetalle} />
      )}

      {stockProducto && (
        <StockAjusteModal
          producto={stockProducto}
          onGuardar={(stockCantidad) =>
            ajustarStock.mutate(
              { id: stockProducto.id, stockCantidad },
              { onSuccess: () => setStockProducto(null) }
            )
          }
          onCancelar={() => setStockProducto(null)}
          cargando={ajustarStock.isPending}
        />
      )}
    </div>
  );
}
