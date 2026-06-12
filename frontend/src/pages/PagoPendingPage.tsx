/**
 * PagoPendingPage — /pago/pending
 *
 * MP redirige aquí cuando el pago queda pendiente de acreditación
 * (por ejemplo: pago en efectivo en Rapipago/Pago Fácil, o transferencia bancaria MP).
 *
 * El carrito sigue en "pendiente" hasta que MP acredite el pago
 * y nos avise por webhook.
 */
import { useNavigate } from "react-router-dom";

export default function PagoPendingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#000000] px-4">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 dark:bg-[#3a2c00] rounded-full mb-4">
          <svg
            className="w-8 h-8 text-yellow-600 dark:text-[#ffd60a]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Pago pendiente
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          Tu pago está siendo procesado por Mercado Pago.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mb-8">
          Cuando se acredite el pago recibirás una notificación y tu pedido
          quedará confirmado automáticamente.
        </p>

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
