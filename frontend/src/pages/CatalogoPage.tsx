import { useState } from "react";
import { useProductosQuery } from "../hooks/useProductos";
import { useCategoriasQuery } from "../hooks/useCategorias";
import { useUnidadesMedidaQuery } from "../hooks/useUnidadesMedida";
import ProductoCard from "../components/ProductoCard";
import Pagination from "../components/Pagination";
import { useAuthStore } from "../stores/authStore";
import { useCartStore } from "../stores/cartStore";
import type { Categoria, FiltrosProductos, Producto } from "../types";

const ITEMS_POR_PAGINA = 8;

export default function CatalogoPage() {
  const [filtros, setFiltros] = useState<FiltrosProductos>({
    busqueda: "", skip: 0, limit: ITEMS_POR_PAGINA, disponible: true,
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const { data, isLoading, isError } = useProductosQuery(filtros);
  const { data: categorias = [] } = useCategoriasQuery();
  const { data: unidades = [] } = useUnidadesMedidaQuery();

  const user = useAuthStore((s) => s.user);
  const addItem = useCartStore((s) => s.addItem);
  const esCliente = user?.roles.includes("CLIENT") ?? false;

  // El carrito es client-side (RN-CR01): agregar solo toca el store de Zustand.
  const handleAgregarAlCarrito = (cantidad: number, producto: Producto) => {
    addItem({
      producto_id: producto.id,
      nombre: producto.nombre,
      cantidad,
      precio_unitario: producto.precioBase,
      subtotal: producto.precioBase * cantidad,
    });
    setToastMessage(`${producto.nombre} agregado al carrito`);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const cambiarFiltro = (parcial: Partial<FiltrosProductos>) =>
    setFiltros((f) => ({ ...f, ...parcial, skip: 0 }));

  const items = data?.items ?? [];

  function limpiar() {
    setFiltros({ busqueda: "", skip: 0, limit: ITEMS_POR_PAGINA, disponible: true });
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Catalogo</h1>
        <p className="text-gray-500 dark:text-gray-400">Explora todos nuestros productos disponibles.</p>
      </header>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* MAIN: productos */}
        <div className="flex-1 order-2 lg:order-1">
          {isLoading && <p className="text-center text-gray-500 dark:text-gray-400 py-12">Cargando productos...</p>}
          {isError && <p className="text-center text-[#ff3b30] dark:text-[#ff453a] py-12">Error al cargar el catalogo.</p>}
          {!isLoading && !isError && items.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-12">No se encontraron productos.</p>
          )}

          {items.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((p: Producto) => (
                  <ProductoCard
                    key={p.id}
                    producto={p}
                    categorias={categorias}
                    unidades={unidades}
                    esAdmin={false}
                    esCliente={esCliente}
                    onAgregarAlCarrito={(cantidad) =>
                      handleAgregarAlCarrito(cantidad, p)
                    }
                  />
                ))}
              </div>
              {data && (
                <Pagination total={data.total} skip={data.skip}
                  limit={data.limit} onCambioPagina={(skip) => setFiltros((f) => ({ ...f, skip }))} />
              )}
            </>
          )}
        </div>

        {/* ASIDE: filtros (derecha en desktop, desplegable arriba en mobile) */}
        <aside className="order-1 lg:order-2 lg:w-72 shrink-0">
          <button
            type="button"
            onClick={() => setFiltrosAbiertos((v) => !v)}
            className="lg:hidden w-full flex items-center justify-between bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-[#3a3a3c] rounded-2xl px-4 py-3 mb-3 shadow-sm text-sm font-semibold text-gray-900 dark:text-white"
            aria-expanded={filtrosAbiertos}
          >
            <span>Filtros</span>
            <svg
              className={`w-5 h-5 transition-transform ${filtrosAbiertos ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div className={`${filtrosAbiertos ? "block" : "hidden"} lg:block lg:sticky lg:top-20`}>
            <div className="bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-[#3a3a3c] rounded-2xl p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Buscar</label>
                  <input
                    type="text" value={filtros.busqueda ?? ""}
                    onChange={(e) => cambiarFiltro({ busqueda: e.target.value })}
                    placeholder="Pizza, hamburguesa..."
                    className="w-full bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-[#3a3a3c] rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Categoria</label>
                  <select
                    value={filtros.categoriaId ?? ""}
                    onChange={(e) => cambiarFiltro({ categoriaId: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-[#3a3a3c] rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  >
                    <option value="">Todas</option>
                    {categorias.filter((c: Categoria) => !c.eliminadoEn).map((c: Categoria) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Precio min</label>
                  <input
                    type="number" min={0} value={filtros.precioMin ?? ""}
                    onChange={(e) => cambiarFiltro({ precioMin: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-[#3a3a3c] rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Precio max</label>
                  <input
                    type="number" min={0} value={filtros.precioMax ?? ""}
                    onChange={(e) => cambiarFiltro({ precioMax: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-[#3a3a3c] rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-[#3a3a3c]">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={filtros.sinAlergenos ?? false}
                    onChange={(e) => cambiarFiltro({ sinAlergenos: e.target.checked })}
                    className="w-4 h-4 accent-[#ff9500]" />
                  Solo sin alergenos
                </label>
                <button type="button" onClick={limpiar}
                  className="text-sm text-[#007aff] dark:text-[#0a84ff] hover:opacity-75">
                  Limpiar
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-3 rounded-lg shadow-lg z-50">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
