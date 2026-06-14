import { useState } from "react";
import type { Producto, Categoria, UnidadMedida } from "../types";
import AgregarAlCarritoModal from "./AgregarAlCarritoModal";

interface Props {
  producto: Producto;
  categorias: Categoria[];
  esAdmin: boolean;
  esCliente?: boolean;
  unidades?: UnidadMedida[];
  onEliminar?: (p: Producto) => void;
  onReactivar?: (p: Producto) => void;
  onEditar?: (p: Producto) => void;
  onAjustarStock?: (p: Producto) => void;
  onAgregarAlCarrito?: (cantidad: number) => void | Promise<void>;
}

export default function ProductoCard({
  producto,
  categorias,
  esAdmin,
  esCliente = false,
  unidades = [],
  onEliminar,
  onReactivar,
  onEditar,
  onAjustarStock,
  onAgregarAlCarrito,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const eliminado = producto.eliminadoEn !== null;
  const sinStock = producto.stockCantidad === 0;

  const handleAgregarClick = async (cantidad: number) => {
    setIsLoading(true);
    try {
      if (onAgregarAlCarrito) {
        await onAgregarAlCarrito(cantidad);
        setShowModal(false);
      }
    } catch (error) {
      console.error("Error al agregar al carrito", error);
    } finally {
      setIsLoading(false);
    }
  };

  const nombresCategorias = producto.categoriaIds
    .map((id) => categorias.find((c) => c.id === id)?.nombre)
    .filter(Boolean).join(", ");

  const unidadVenta = unidades.find((u) => u.id === producto.unidadVentaId);

  return (
    <div className={`bg-white dark:bg-[#1c1c1e] border rounded-2xl shadow-sm overflow-hidden flex flex-col transition-shadow hover:shadow-md ${
      eliminado ? "opacity-60 border-red-300 dark:border-red-900" : "border-gray-200 dark:border-[#3a3a3c]"
    }`}>
      {/* Imagen */}
      <div className="relative h-40 bg-gray-100 dark:bg-[#2c2c2e]">
        {producto.imagenUrl ? (
          <img src={producto.imagenUrl} alt={producto.nombre}
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-600 text-sm">
            Sin imagen
          </div>
        )}
        {eliminado && (
          <span className="absolute top-2 right-2 bg-[#ff3b30] text-white text-xs font-bold px-2 py-1 rounded-lg">
            Dado de baja
          </span>
        )}
        {!eliminado && sinStock && (
          <span className="absolute top-2 right-2 bg-[#ff9500] text-white text-xs font-bold px-2 py-1 rounded-lg">
            Sin stock
          </span>
        )}
        {!eliminado && !producto.disponible && !sinStock && (
          <span className="absolute top-2 right-2 bg-gray-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
            No disponible
          </span>
        )}
        {producto.tieneAlergenos && (
          <span className="absolute bottom-2 left-2 bg-[#ff9500] text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            Contiene alergenos
          </span>
        )}
      </div>

      {/* Cuerpo */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-base text-gray-900 dark:text-white">{producto.nombre}</h3>
          <span className={`flex-shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full ${
            producto.tipoProducto === "elaborado"
              ? "bg-[#ff9500]/10 text-[#ff9500] dark:text-[#ff9f0a]"
              : "bg-[#34c759]/10 text-[#34c759] dark:text-[#30d158]"
          }`}>
            {producto.tipoProducto === "elaborado" ? "🍳" : "📦"}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{producto.descripcion}</p>

        {nombresCategorias && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
            {nombresCategorias}
          </p>
        )}

        <div className="flex items-end justify-between mt-auto pt-2">
          <div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              ${producto.precioBase.toLocaleString("es-AR")}
            </span>
            {unidadVenta && (
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">/ {unidadVenta.simbolo}</span>
            )}
          </div>
          {esAdmin && (
            <div className="text-right">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Stock: <span className="font-semibold text-gray-700 dark:text-gray-200">{producto.stockCantidad}</span>
              </p>
              {producto.precioSugerido > 0 && (
                <p className="text-xs text-[#34c759] dark:text-[#30d158]">
                  Sug: ${Math.round(producto.precioSugerido).toLocaleString("es-AR")}
                </p>
              )}
            </div>
          )}
        </div>

        {esAdmin && (
          <div className="flex flex-wrap gap-2 mt-3">
            {!eliminado && onEditar && (
              <button type="button" onClick={() => onEditar(producto)}
                className="flex-1 bg-[#ff9500] dark:bg-[#ff9f0a] hover:opacity-90 text-white text-sm py-1.5 rounded-xl transition-opacity">
                Editar
              </button>
            )}
            {/* Botón de ajuste de stock solo para productos terminados activos */}
            {!eliminado && producto.tipoProducto === "terminado" && onAjustarStock && (
              <button type="button" onClick={() => onAjustarStock(producto)}
                className="flex-1 bg-[#007aff] dark:bg-[#0a84ff] hover:opacity-90 text-white text-sm py-1.5 rounded-xl transition-opacity">
                📦 Stock
              </button>
            )}
            {!eliminado && onEliminar && (
              <button type="button" onClick={() => onEliminar(producto)}
                className="flex-1 bg-[#ff3b30] dark:bg-[#ff453a] hover:opacity-90 text-white text-sm py-1.5 rounded-xl transition-opacity">
                Dar de baja
              </button>
            )}
            {eliminado && onReactivar && (
              <button type="button" onClick={() => onReactivar(producto)}
                className="flex-1 bg-[#34c759] dark:bg-[#30d158] hover:opacity-90 text-white text-sm py-1.5 rounded-xl transition-opacity">
                Reactivar
              </button>
            )}
          </div>
        )}

        {esCliente && !eliminado && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            disabled={sinStock || !producto.disponible}
            className="w-full mt-3 bg-[#34c759] dark:bg-[#30d158] hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold py-1.5 rounded-xl transition-opacity"
          >
            {sinStock ? "Sin Stock" : !producto.disponible ? "No Disponible" : "Agregar al Carrito"}
          </button>
        )}
      </div>

      {/* Modal */}
      <AgregarAlCarritoModal
        producto={producto}
        isOpen={showModal}
        isLoading={isLoading}
        onClose={() => setShowModal(false)}
        onConfirm={handleAgregarClick}
      />
    </div>
  );
}
