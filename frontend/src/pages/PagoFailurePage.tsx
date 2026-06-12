/**
 * PagoFailurePage — /pago/failure
 *
 * MP redirige aquí cuando el pago fue rechazado.
 * El carrito sigue activo en "pendiente", el usuario puede intentar de nuevo.
 */
import { useNavigate } from "react-router-dom";

export default function PagoFailurePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#000000] px-4">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-[#5c2c2c] rounded-full mb-4">
          <svg
            className="w-8 h-8 text-red-600 dark:text-[#ff453a]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Pago rechazado
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Tu pago no pudo procesarse. Tu carrito sigue guardado, podés intentarlo
          de nuevo o elegir otra forma de pago.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => navigate("/checkout")}
            className="w-full bg-[#007aff] dark:bg-[#0a84ff] text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity"
          >
            Intentar de nuevo
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
