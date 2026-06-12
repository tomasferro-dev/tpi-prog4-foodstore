import { useState } from "react";
import type { Producto } from "../types";

interface Props {
  producto: Producto;
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: (cantidad: number) => void;
}

export default function AgregarAlCarritoModal({
  producto,
  isOpen,
  isLoading,
  onClose,
  onConfirm,
}: Props) {
  const [cantidad, setCantidad] = useState(1);

  const handleConfirm = () => {
    if (cantidad > 0) {
      onConfirm(cantidad);
      setCantidad(1);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#1c1c1e] rounded-lg shadow-lg max-w-sm w-full p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Agregar al Carrito
          </h2>

          {/* Producto */}
          <div className="mb-6 pb-6 border-b border-gray-200 dark:border-[#3a3a3c]">
            <p className="font-semibold text-gray-900 dark:text-white">
              {producto.nombre}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              ${producto.precioBase.toFixed(2)} por unidad
            </p>
          </div>

          {/* Cantidad */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Cantidad
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                disabled={cantidad <= 1}
                className="px-3 py-2 bg-gray-100 dark:bg-[#2c2c2e] text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-[#3a3a3c] disabled:opacity-50 transition-colors"
              >
                −
              </button>
              <input
                type="number"
                min="1"
                max="999"
                value={cantidad}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setCantidad(Math.max(1, Math.min(999, val)));
                }}
                className="w-16 px-2 py-2 border border-gray-300 dark:border-[#3a3a3c] rounded-lg bg-white dark:bg-[#2c2c2e] text-gray-900 dark:text-white text-center focus:outline-none focus:border-[#007aff]"
              />
              <button
                onClick={() => setCantidad(cantidad + 1)}
                className="px-3 py-2 bg-gray-100 dark:bg-[#2c2c2e] text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-[#3a3a3c] transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Total estimado */}
          <div className="mb-6 p-3 bg-gray-50 dark:bg-[#2c2c2e] rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total estimado</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${(producto.precioBase * cantidad).toFixed(2)}
            </p>
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-gray-100 dark:bg-[#2c2c2e] text-gray-900 dark:text-white font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-[#3a3a3c] disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-[#007aff] dark:bg-[#0a84ff] text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isLoading ? "Agregando..." : "Agregar"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
