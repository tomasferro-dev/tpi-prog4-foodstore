import { useLocation, useNavigate } from "react-router-dom";

type ProximamenteState = { metodo?: string } | null;

export default function ProximamentePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const metodo = (location.state as ProximamenteState)?.metodo;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-sm border border-gray-200 dark:border-[#3a3a3c] max-w-md w-full p-8 text-center">
        {/* Icono */}
        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-[#ff9500]/10 border border-[#ff9500]/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-[#ff9500]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l2.5 2.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Próximamente
        </h1>

        <p className="text-gray-500 dark:text-gray-400 mb-1">
          {metodo
            ? <>La forma de pago <span className="font-semibold text-gray-900 dark:text-white">{metodo}</span> todavía no está disponible.</>
            : "Esta forma de pago todavía no está disponible."}
        </p>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          Estamos trabajando para habilitarla muy pronto. Por ahora podés pagar con{" "}
          <span className="font-semibold text-[#009ee3]">Mercado Pago</span>.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate("/checkout")}
            className="w-full bg-[#007aff] dark:bg-[#0a84ff] hover:opacity-90 text-white font-semibold py-2.5 rounded-lg transition-opacity"
          >
            Elegir otra forma de pago
          </button>
          <button
            onClick={() => navigate("/")}
            className="w-full bg-gray-100 dark:bg-[#2c2c2e] text-gray-900 dark:text-white font-semibold py-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-[#3a3a3c] transition-colors"
          >
            Volver al catálogo
          </button>
        </div>
      </div>
    </div>
  );
}
