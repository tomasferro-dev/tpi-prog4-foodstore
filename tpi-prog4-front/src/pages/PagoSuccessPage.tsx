/**
 * PagoSuccessPage — /pago/success
 *
 * MP redirige aquí con query params:
 *   ?collection_id=...&collection_status=approved&payment_id=...
 *   &status=approved&external_reference=<pedido_id>&...
 *
 * Aquí confirmamos el carrito activo con forma de pago MERCADOPAGO
 * y mostramos el resultado al usuario.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { confirmarCompra } from "../api/pedidos.api";
import { useCartStore } from "../stores/cartStore";
import type { PedidoConDetalle } from "../types/pedidos";

type PageState = "loading" | "success" | "error";

export default function PagoSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clearCart = useCartStore((s) => s.clearCart);

  const [pageState, setPageState] = useState<PageState>("loading");
  const [pedido, setPedido] = useState<PedidoConDetalle | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  /**
   * Guardia contra la doble ejecución de useEffect en React 18 Strict Mode
   * (development). El ref persiste entre el desmontaje/remontaje simulado,
   * así la segunda invocación sale antes de llamar a la API.
   */
  const yaEjecutado = useRef(false);

  useEffect(() => {
    if (yaEjecutado.current) return;
    yaEjecutado.current = true;

    const confirmar = async () => {
      try {
        // MP envía el status aprobado — confirmamos el carrito en nuestro sistema
        const pedidoConfirmado = await confirmarCompra({
          formaPagoCodigo: "MERCADOPAGO",
          direccionId: null,
          notas: `Pago MP aprobado. Payment ID: ${searchParams.get("payment_id") ?? ""}`,
        });

        clearCart();
        setPedido(pedidoConfirmado);
        setPageState("success");
      } catch (err: any) {
        // Si el pedido ya fue confirmado (carrito vacío), igual mostramos éxito genérico
        const msg: string = err?.detail ?? err?.message ?? "Error al confirmar el pedido";
        if (msg.toLowerCase().includes("carrito")) {
          // El carrito ya no existe → ya fue procesado antes
          clearCart();
          setPageState("success");
        } else {
          setErrorMsg(msg);
          setPageState("error");
        }
      }
    };

    confirmar();
  }, []);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (pageState === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#000000] gap-4">
        <div className="w-12 h-12 border-4 border-[#009ee3] border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-600 dark:text-gray-400">Confirmando tu pago...</p>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (pageState === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#000000] px-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-[#5c2c2c] rounded-full mb-4">
            <svg className="w-8 h-8 text-red-600 dark:text-[#ff453a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Error al confirmar
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{errorMsg}</p>
          <button
            onClick={() => navigate("/checkout")}
            className="w-full bg-[#007aff] dark:bg-[#0a84ff] text-white font-semibold py-3 rounded-lg hover:opacity-90"
          >
            Volver al Checkout
          </button>
        </div>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#000000] py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Icono y título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#34c759] dark:bg-[#30d158] rounded-full mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            ¡Pago aprobado!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Tu pago fue procesado exitosamente por Mercado Pago.
          </p>
        </div>

        {/* Detalle del pedido */}
        {pedido && (
          <div className="bg-white dark:bg-[#1c1c1e] rounded-lg shadow p-6 mb-6">
            <div className="mb-6 pb-6 border-b border-gray-200 dark:border-[#3a3a3c]">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Número de Pedido</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">#{pedido.id}</p>
            </div>

            <div className="mb-6 pb-6 border-b border-gray-200 dark:border-[#3a3a3c]">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Productos</h2>
              <div className="space-y-2">
                {pedido.items.map((item) => (
                  <div key={item.productoId} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {item.nombreSnapshot} x {item.cantidad}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      ${Number(item.subtotalSnap).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Subtotal:</span>
                <span>${Number(pedido.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Envío:</span>
                <span>${Number(pedido.costoEnvio).toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-200 dark:border-[#3a3a3c] pt-2 flex justify-between text-lg font-bold text-gray-900 dark:text-white">
                <span>Total pagado:</span>
                <span>${Number(pedido.total).toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="space-y-3">
          <button
            onClick={() => navigate("/")}
            className="w-full bg-[#007aff] dark:bg-[#0a84ff] text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity"
          >
            Volver al Catálogo
          </button>
        </div>
      </div>
    </div>
  );
}
