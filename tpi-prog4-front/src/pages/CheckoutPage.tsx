import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCartStore } from "../stores/cartStore";

import { getCarritoActual, getFormasPago } from "../api/pedidos.api";
import { crearPreferencia } from "../api/pagos.api";
import type { FormaPago } from "../types/pedidos";

// Nombre a mostrar por código. La forma de la API de pagos se rotula "Mercado Pago".
const FORMA_PAGO_DISPLAY: Record<string, string> = {
  MERCADOPAGO: "Mercado Pago",
};

export default function CheckoutPage() {
  const navigate = useNavigate();

  // Estado local
  const [formasPago, setFormasPago] = useState<FormaPago[]>([]);
  const [selectedFormaPago, setSelectedFormaPago] = useState<string>("MERCADOPAGO");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Esperar a que cartStore rehidrate antes de evaluar si el carrito está vacío
  const [cartHydrated, setCartHydrated] = useState(
    () => useCartStore.persist.hasHydrated()
  );
  useEffect(() => {
    if (cartHydrated) return;
    const unsub = useCartStore.persist.onFinishHydration(() => setCartHydrated(true));
    return unsub;
  }, [cartHydrated]);

  // Estado del carrito
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal);
  const costoEnvio = useCartStore((s) => s.costoEnvio);
  const total = useCartStore((s) => s.total);

  const nombreForma = (codigo: string) =>
    FORMA_PAGO_DISPLAY[codigo] ??
    formasPago.find((f) => f.codigo === codigo)?.descripcion ??
    codigo;

  // Cargar catálogos
  useEffect(() => {
    const loadData = async () => {
      try {
        const formas = await getFormasPago();
        setFormasPago(formas);
        if (formas.length > 0) {
          setSelectedFormaPago(formas[0].codigo);
        }
      } catch (err) {
        setError("Error al cargar formas de pago");
        console.error(err);
      }
    };
    loadData();
  }, []);

  // Si no hay items (y ya terminó de cargar), redirigir al catálogo
  useEffect(() => {
    if (cartHydrated && items.length === 0) {
      navigate("/", { replace: true });
    }
  }, [cartHydrated, items.length, navigate]);

  const handleConfirmarCompra = async () => {
    // Solo Mercado Pago está operativo. Las demás formas (transferencia,
    // retiro en local) todavía no están disponibles → página "Próximamente".
    if (selectedFormaPago !== "MERCADOPAGO") {
      navigate("/proximamente", { state: { metodo: nombreForma(selectedFormaPago) } });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Verificar que haya carrito activo
      const carritoActual = await getCarritoActual();
      if (!carritoActual) {
        setError("No hay carrito activo");
        setIsLoading(false);
        return;
      }

      // ── Flujo Mercado Pago ──────────────────────────────────────────────
      // Creamos la preferencia y redirigimos a la plataforma de pago de MP.
      // Al volver, MP nos manda a /pago/success (o /failure o /pending).
      const initPoint = await crearPreferencia();
      window.location.href = initPoint; // sale de nuestra SPA
    } catch (err: any) {
      setError(err?.detail || "Error al confirmar compra");
      console.error(err);
      setIsLoading(false);
    }
  };

  const isMercadoPago = selectedFormaPago === "MERCADOPAGO";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#000000] py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Confirmar Compra
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Resumen del carrito */}
          <div className="lg:col-span-2 space-y-6">
            {/* Items */}
            <div className="bg-white dark:bg-[#1c1c1e] rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Resumen del Carrito
              </h2>

              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.producto_id}
                    className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-[#3a3a3c]"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {item.nombre}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        ${item.precio_unitario.toFixed(2)} x {item.cantidad}
                      </p>
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      ${item.subtotal.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Forma de pago */}
            <div className="bg-white dark:bg-[#1c1c1e] rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Forma de Pago
              </h2>

              <select
                value={selectedFormaPago}
                onChange={(e) => setSelectedFormaPago(e.target.value)}
                disabled={formasPago.length === 0}
                className="w-full px-4 py-2 border border-gray-300 dark:border-[#3a3a3c] rounded-lg bg-white dark:bg-[#2c2c2e] text-gray-900 dark:text-white focus:outline-none focus:border-[#007aff]"
              >
                {formasPago.map((forma) => (
                  <option key={forma.codigo} value={forma.codigo}>
                    {nombreForma(forma.codigo)}
                  </option>
                ))}
              </select>

              {/* Badge informativo cuando se selecciona MP */}
              {isMercadoPago && (
                <div className="mt-3 flex items-center gap-2 p-3 bg-blue-50 dark:bg-[#1c2a3a] border border-blue-200 dark:border-[#0a84ff] rounded-lg">
                  <svg className="w-5 h-5 text-[#007aff] dark:text-[#0a84ff] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-blue-700 dark:text-[#0a84ff]">
                    Serás redirigido a Mercado Pago para completar el pago de forma segura.
                  </p>
                </div>
              )}

              {/* Aviso cuando la forma elegida aún no está disponible */}
              {!isMercadoPago && (
                <div className="mt-3 flex items-center gap-2 p-3 bg-[#ff9500]/10 border border-[#ff9500]/30 rounded-lg">
                  <svg className="w-5 h-5 text-[#ff9500] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l2.5 2.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                  </svg>
                  <p className="text-sm text-[#b26a00] dark:text-[#ff9500]">
                    Esta forma de pago estará disponible próximamente. Por ahora podés pagar con Mercado Pago.
                  </p>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 dark:bg-[#5c2c2c] border border-red-200 dark:border-[#ff453a] rounded-lg p-4 text-red-700 dark:text-[#ff453a]">
                {error}
              </div>
            )}
          </div>

          {/* Total y botón */}
          <div>
            <div className="bg-white dark:bg-[#1c1c1e] rounded-lg shadow p-6 sticky top-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Total
              </h2>

              <div className="space-y-2 mb-6">
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

              <button
                onClick={handleConfirmarCompra}
                disabled={isLoading}
                className={`w-full hover:opacity-90 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-opacity flex items-center justify-center gap-2 ${
                  isMercadoPago
                    ? "bg-[#009ee3]"  // Azul de Mercado Pago
                    : "bg-[#007aff] dark:bg-[#0a84ff]"
                }`}
              >
                {isLoading ? (
                  "Procesando..."
                ) : isMercadoPago ? (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2c5.514 0 10 4.486 10 10s-4.486 10-10 10S2 17.514 2 12 6.486 2 12 2zm-1 5v2H9v2h2v6h2v-6h2V9h-2V7h-2z"/>
                    </svg>
                    Pagar con Mercado Pago
                  </>
                ) : (
                  "Continuar"
                )}
              </button>

              <button
                onClick={() => navigate("/")}
                className="w-full mt-3 bg-gray-100 dark:bg-[#2c2c2e] text-gray-900 dark:text-white font-semibold py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-[#3a3a3c] transition-colors"
              >
                Volver al Catálogo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
