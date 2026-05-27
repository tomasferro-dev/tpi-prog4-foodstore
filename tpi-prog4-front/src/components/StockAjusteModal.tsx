import { useState } from "react";
import type { Producto } from "../types";

interface Props {
  producto: Producto;
  onGuardar: (stockCantidad: number) => void;
  onCancelar: () => void;
  cargando?: boolean;
}

type Modo = "absoluto" | "delta";

export default function StockAjusteModal({ producto, onGuardar, onCancelar, cargando }: Props) {
  const [modo, setModo] = useState<Modo>("absoluto");
  const [cantidad, setCantidad] = useState<number>(producto.stockCantidad);
  const [delta, setDelta] = useState<number>(0);
  const [error, setError] = useState("");

  const stockFinal = modo === "absoluto" ? cantidad : producto.stockCantidad + delta;
  const esValido = stockFinal >= 0;

  function handleGuardar() {
    if (!esValido) {
      setError("El stock no puede ser negativo.");
      return;
    }
    onGuardar(stockFinal);
  }

  const inputCls =
    "w-full bg-gray-50 dark:bg-[#3a3a3c] border border-gray-200 dark:border-[#48484a] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007aff] text-right tabular-nums";

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/75 z-50 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 dark:border-[#3a3a3c]">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Gestión de stock</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
              {producto.nombre}
            </p>
          </div>
          <button
            onClick={onCancelar}
            className="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#3a3a3c] text-xl leading-none transition-colors"
          >
            &times;
          </button>
        </div>

        {/* ── Stock actual ── */}
        <div className="px-6 pt-5">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#2c2c2e] rounded-xl border border-gray-200 dark:border-[#3a3a3c]">
            <span className="text-sm text-gray-500 dark:text-gray-400">Stock actual</span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              {producto.stockCantidad}
              <span className="text-sm font-normal text-gray-400 dark:text-gray-500 ml-1">u.</span>
            </span>
          </div>
        </div>

        {/* ── Selector de modo ── */}
        <div className="px-6 pt-4">
          <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-[#3a3a3c] text-sm">
            <button
              type="button"
              onClick={() => { setModo("absoluto"); setError(""); }}
              className={`flex-1 py-2 font-medium transition-colors ${
                modo === "absoluto"
                  ? "bg-[#007aff] dark:bg-[#0a84ff] text-white"
                  : "bg-white dark:bg-[#2c2c2e] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#3a3a3c]"
              }`}
            >
              Establecer
            </button>
            <button
              type="button"
              onClick={() => { setModo("delta"); setError(""); }}
              className={`flex-1 py-2 font-medium transition-colors ${
                modo === "delta"
                  ? "bg-[#007aff] dark:bg-[#0a84ff] text-white"
                  : "bg-white dark:bg-[#2c2c2e] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#3a3a3c]"
              }`}
            >
              Ajustar +/−
            </button>
          </div>
        </div>

        {/* ── Input según modo ── */}
        <div className="px-6 pt-4 pb-2 space-y-3">
          {modo === "absoluto" ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Nueva cantidad
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={cantidad}
                onChange={(e) => { setCantidad(Number(e.target.value)); setError(""); }}
                className={inputCls}
                autoFocus
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                Ingresá el total de unidades disponibles
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Cantidad a sumar (negativo para restar)
              </label>
              <input
                type="number"
                step={1}
                value={delta}
                onChange={(e) => { setDelta(Number(e.target.value)); setError(""); }}
                className={inputCls}
                autoFocus
              />
              {/* Preview del resultado */}
              <div className={`mt-3 flex items-center justify-between px-4 py-2.5 rounded-xl text-sm ${
                stockFinal < 0
                  ? "bg-[#ff3b30]/5 dark:bg-[#ff453a]/10 border border-[#ff3b30]/30 dark:border-[#ff453a]/30"
                  : "bg-[#007aff]/5 dark:bg-[#0a84ff]/10 border border-[#007aff]/20 dark:border-[#0a84ff]/20"
              }`}>
                <span className="text-gray-500 dark:text-gray-400">
                  {producto.stockCantidad} {delta >= 0 ? "+" : "−"} {Math.abs(delta)} =
                </span>
                <span className={`text-xl font-bold tabular-nums ${
                  stockFinal < 0
                    ? "text-[#ff3b30] dark:text-[#ff453a]"
                    : "text-[#007aff] dark:text-[#0a84ff]"
                }`}>
                  {stockFinal}
                  <span className="text-sm font-normal ml-1 text-gray-400 dark:text-gray-500">u.</span>
                </span>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-[#ff3b30] dark:text-[#ff453a]">{error}</p>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex gap-3 px-6 py-5">
          <button
            type="button"
            onClick={onCancelar}
            className="flex-1 py-2.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-[#48484a] rounded-xl hover:bg-gray-50 dark:hover:bg-[#3a3a3c] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGuardar}
            disabled={cargando || !esValido}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-[#007aff] dark:bg-[#0a84ff] hover:opacity-90 rounded-xl disabled:opacity-60 transition-opacity"
          >
            {cargando ? "Guardando..." : "Confirmar"}
          </button>
        </div>

      </div>
    </div>
  );
}
