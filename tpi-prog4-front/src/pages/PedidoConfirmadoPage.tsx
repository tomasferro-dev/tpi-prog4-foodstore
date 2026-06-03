import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getPedidoById } from "../api/pedidos.api";
import type { PedidoConDetalle } from "../types/pedidos";

export default function PedidoConfirmadoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const pedidoId = (location.state as { pedidoId?: number } | undefined)?.pedidoId;

  const [pedido, setPedido] = useState<PedidoConDetalle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pedidoId) {
      navigate("/", { replace: true });
      return;
    }

    const loadPedido = async () => {
      try {
        const data = await getPedidoById(pedidoId);
        setPedido(data);
      } catch (err: any) {
        setError(err?.detail || "Error al cargar el pedido");
      } finally {
        setIsLoading(false);
      }
    };

    loadPedido();
  }, [pedidoId, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#000000]">
        <p className="text-gray-600 dark:text-gray-400">Cargando...</p>
      </div>
    );
  }

  if (error || !pedido) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#000000]">
        <div className="max-w-md text-center">
          <p className="text-[#ff3b30] dark:text-[#ff453a] mb-4">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="bg-[#007aff] dark:bg-[#0a84ff] text-white px-6 py-2 rounded-lg hover:opacity-90"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#000000] py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Success message */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#34c759] dark:bg-[#30d158] rounded-full mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            ¡Pedido Confirmado!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Tu pedido ha sido confirmado exitosamente.
          </p>
        </div>

        {/* Order details */}
        <div className="bg-white dark:bg-[#1c1c1e] rounded-lg shadow p-6 mb-6">
          <div className="mb-6 pb-6 border-b border-gray-200 dark:border-[#3a3a3c]">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Número de Pedido
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              #{pedido.id}
            </p>
          </div>

          {/* Items */}
          <div className="mb-6 pb-6 border-b border-gray-200 dark:border-[#3a3a3c]">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
              Productos
            </h2>
            <div className="space-y-2">
              {pedido.items.map((item) => (
                <div
                  key={item.productoId}
                  className="flex justify-between text-sm"
                >
                  <span className="text-gray-600 dark:text-gray-400">
                    {item.nombreSnapshot} x {item.cantidad}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    ${item.subtotalSnap.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Subtotal:</span>
              <span>${pedido.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Envío:</span>
              <span>${pedido.costoEnvio.toFixed(2)}</span>
            </div>
            <div className="border-t border-gray-200 dark:border-[#3a3a3c] pt-2 flex justify-between text-lg font-bold text-gray-900 dark:text-white">
              <span>Total:</span>
              <span>${pedido.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Order info */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-[#3a3a3c]">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600 dark:text-gray-400 mb-1">
                  Forma de Pago
                </p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {pedido.formaPagoCodigo}
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 mb-1">Estado</p>
                <p className="font-medium text-gray-900 dark:text-white capitalize">
                  {pedido.estadoCodigo.replace(/_/g, " ")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => navigate("/mis-pedidos")}
            className="w-full bg-[#007aff] dark:bg-[#0a84ff] text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity"
          >
            Ver mis Pedidos
          </button>
          <button
            onClick={() => navigate("/")}
            className="w-full bg-gray-100 dark:bg-[#2c2c2e] text-gray-900 dark:text-white font-semibold py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-[#3a3a3c] transition-colors"
          >
            Volver al Catálogo
          </button>
        </div>
      </div>
    </div>
  );
}
