import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCartStore } from "../stores/cartStore";
import { eliminarDelCarrito, actualizarItemCarrito } from "../api/pedidos.api";

interface CarritoModalProps {
  onClose: () => void;
}

export default function CarritoModal({ onClose }: CarritoModalProps) {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal);
  const costoEnvio = useCartStore((s) => s.costoEnvio);
  const total = useCartStore((s) => s.total);

  const setCarrito = useCartStore((s) => s.setCarrito);

  const [isUpdating, setIsUpdating] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isClearingCart, setIsClearingCart] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleCheckout = () => {
    onClose();
    navigate("/checkout");
  };

  const handleUpdateItem = async (productoId: number, cantidad: number) => {
    setIsUpdating(productoId);
    try {
      // Llamar al backend para actualizar cantidad
      const updatedCarrito = await actualizarItemCarrito(productoId, Math.max(1, cantidad));
      // Sincronizar el estado con la respuesta del backend
      setCarrito(updatedCarrito);
    } catch (error) {
      console.error("Error al actualizar cantidad:", error);
      // En caso de error, no hacer nada (mantener el estado actual)
    } finally {
      setIsUpdating(null);
    }
  };

  const handleRemoveItem = async (productoId: number) => {
    setIsDeleting(productoId);
    try {
      // Llamar al backend para eliminar del carrito
      const updatedCarrito = await eliminarDelCarrito(productoId);
      // Sincronizar el estado con la respuesta del backend
      setCarrito(updatedCarrito);
    } catch (error) {
      console.error("Error al eliminar producto:", error);
      // En caso de error, no hacer nada (mantener el estado actual)
    } finally {
      setIsDeleting(null);
    }
  };

  const handleClearCart = async () => {
    setIsClearingCart(true);
    try {
      // Eliminar todos los items del carrito
      const itemsToClear = [...items];
      for (const item of itemsToClear) {
        try {
          await eliminarDelCarrito(item.producto_id);
        } catch (error) {
          console.error(`Error al eliminar producto ${item.producto_id}:`, error);
        }
      }
      // Sincronizar carrito vacío
      setCarrito(null);
      setShowClearConfirm(false);
    } catch (error) {
      console.error("Error al vaciar carrito:", error);
    } finally {
      setIsClearingCart(false);
    }
  };

  return (
    <>
      {/* Dialog de confirmación para vaciar carrito */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              ¿Vaciar carrito?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Esto eliminará todos los {items.length} producto{items.length !== 1 ? 's' : ''} de tu carrito. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={isClearingCart}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-[#2c2c2e] rounded-lg hover:bg-gray-200 dark:hover:bg-[#3a3a3c] transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearCart}
                disabled={isClearingCart}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#ff3b30] dark:bg-[#ff453a] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isClearingCart ? "Vaciando..." : "Sí, vaciar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed right-0 top-0 h-screen w-full sm:w-96 bg-white dark:bg-[#1c1c1e] shadow-lg z-50 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-[#3a3a3c] p-4 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Carrito
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-[#2c2c2e] rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
              <svg
                className="w-12 h-12 mb-2 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <p className="text-sm">Tu carrito está vacío</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.producto_id}
                className="flex gap-3 p-3 bg-gray-50 dark:bg-[#2c2c2e] rounded-lg"
              >
                {/* Nombre y subtotal */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {item.nombre}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    ${item.precio_unitario.toFixed(2)} x {item.cantidad}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                    ${item.subtotal.toFixed(2)}
                  </p>
                </div>

                {/* Cantidad y botones */}
                <div className="flex flex-col gap-2 items-end">
                  <div className="flex items-center border border-gray-300 dark:border-[#3a3a3c] rounded-lg">
                    <button
                      onClick={() =>
                        handleUpdateItem(
                          item.producto_id,
                          Math.max(1, item.cantidad - 1)
                        )
                      }
                      disabled={isUpdating === item.producto_id}
                      className="px-2 py-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#3a3a3c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      −
                    </button>
                    <span className="px-3 py-1 text-sm font-medium">
                      {item.cantidad}
                    </span>
                    <button
                      onClick={() =>
                        handleUpdateItem(item.producto_id, item.cantidad + 1)
                      }
                      disabled={isUpdating === item.producto_id}
                      className="px-2 py-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#3a3a3c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => handleRemoveItem(item.producto_id)}
                    disabled={isDeleting === item.producto_id}
                    className="text-xs px-2 py-1 text-[#ff3b30] dark:text-[#ff453a] hover:bg-red-50 dark:hover:bg-[#3a3a3c] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeleting === item.producto_id ? "Eliminando..." : "Eliminar"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Resumen y checkout */}
        {items.length > 0 && (
          <>
            <div className="border-t border-gray-200 dark:border-[#3a3a3c] p-4 space-y-2">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Envío:</span>
                <span>${costoEnvio.toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-200 dark:border-[#3a3a3c] pt-2 flex justify-between text-lg font-bold text-gray-900 dark:text-white">
                <span>Total:</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-[#3a3a3c] p-4 space-y-2">
              <button
                onClick={handleCheckout}
                className="w-full bg-[#007aff] dark:bg-[#0a84ff] hover:opacity-90 text-white font-semibold py-2 rounded-lg transition-opacity disabled:opacity-50"
                disabled={isClearingCart}
              >
                Finalizar Compra
              </button>
              <button
                onClick={onClose}
                className="w-full bg-gray-100 dark:bg-[#2c2c2e] text-gray-900 dark:text-white font-semibold py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-[#3a3a3c] transition-colors disabled:opacity-50"
                disabled={isClearingCart}
              >
                Seguir Comprando
              </button>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="w-full bg-[#ff3b30] dark:bg-[#ff453a] hover:opacity-90 text-white font-semibold py-2 rounded-lg transition-opacity disabled:opacity-50"
                disabled={isClearingCart}
              >
                Vaciar Carrito
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
