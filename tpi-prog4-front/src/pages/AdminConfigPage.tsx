import { useEffect, useState } from "react";
import { useConfigQuery, useConfigMutation } from "../hooks/useConfig";
import type { ConfigPrecio, CostosOperativos } from "../types";

const LABELS: Record<keyof CostosOperativos, string> = {
  salario: "Sueldos mensuales", gas: "Gas", luz: "Electricidad",
  alquiler: "Alquiler", otros: "Otros costos fijos",
};

export default function AdminConfigPage() {
  const { data: config, isLoading, isError } = useConfigQuery();
  const mutation = useConfigMutation();
  const [form, setForm] = useState<ConfigPrecio | null>(null);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    if (config && !form) setForm(structuredClone(config));
  }, [config, form]);

  if (isLoading) return <div className="max-w-4xl mx-auto p-6 text-gray-500 dark:text-gray-400">Cargando...</div>;
  if (isError || !form) return <div className="max-w-4xl mx-auto p-6 text-[#ff3b30] dark:text-[#ff453a]">Error al cargar la configuracion.</div>;

  const total = Object.values(form.costos).reduce((a, b) => a + b, 0);
  const porUnidad = form.unidadesMesEstimadas > 0 ? total / form.unidadesMesEstimadas : 0;
  const hayDiferencias = JSON.stringify(form) !== JSON.stringify(config);

  const inputCls = "w-full bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-[#3a3a3c] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007aff]";

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Configuracion de Precios</h1>
        <p className="text-gray-500 dark:text-gray-400">Los precios sugeridos se recalculan al guardar.</p>
      </header>

      <form onSubmit={(e) => { e.preventDefault(); if (form) mutation.mutate(form, { onSuccess: () => setGuardado(true) }); }} className="space-y-5">

        {/* Costos operativos */}
        <section className="bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-[#3a3a3c] rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Costos operativos mensuales</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(Object.keys(LABELS) as (keyof CostosOperativos)[]).map((campo) => (
              <div key={campo}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{LABELS[campo]}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm">$</span>
                  <input type="number" min={0} step="0.01" value={form.costos[campo]}
                    onChange={(e) => { setForm((f) => f ? { ...f, costos: { ...f.costos, [campo]: Number(e.target.value) } } : f); setGuardado(false); }}
                    className={`${inputCls} pl-7`} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#3a3a3c] flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total mensual</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              ${total.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
            </span>
          </div>
        </section>

        {/* Produccion y margen */}
        <section className="bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-[#3a3a3c] rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Produccion y ganancia</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unidades estimadas por mes</label>
              <input type="number" min={1} step={1} value={form.unidadesMesEstimadas}
                onChange={(e) => { setForm((f) => f ? { ...f, unidadesMesEstimadas: Number(e.target.value) } : f); setGuardado(false); }}
                className={inputCls} />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Para prorratear los costos fijos.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Margen de ganancia (%)</label>
              <div className="relative">
                <input type="number" min={0} max={999} step={1} value={form.porcentajeGanancia}
                  onChange={(e) => { setForm((f) => f ? { ...f, porcentajeGanancia: Number(e.target.value) } : f); setGuardado(false); }}
                  className={`${inputCls} pr-8`} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm">%</span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Multiplicador: x{(1 + form.porcentajeGanancia / 100).toFixed(2)}</p>
            </div>
          </div>
        </section>

        {/* Resumen formula */}
        <section className="bg-[#007aff]/5 dark:bg-[#0a84ff]/10 border border-[#007aff]/20 dark:border-[#0a84ff]/20 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-[#007aff] dark:text-[#0a84ff] mb-3">Como se calcula el precio sugerido</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white dark:bg-[#1c1c1e] rounded-xl p-3 border border-[#007aff]/10 dark:border-[#0a84ff]/10">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Costo op. / unidad</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">${porUnidad.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-white dark:bg-[#1c1c1e] rounded-xl p-3 border border-[#007aff]/10 dark:border-[#0a84ff]/10 flex items-center justify-center">
              <p className="text-xs text-gray-600 dark:text-gray-400 font-mono leading-relaxed">
                (costo_ing + {porUnidad.toLocaleString("es-AR", { maximumFractionDigits: 0 })})<br />
                &times; {(1 + form.porcentajeGanancia / 100).toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-[#1c1c1e] rounded-xl p-3 border border-[#007aff]/10 dark:border-[#0a84ff]/10">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Margen</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{form.porcentajeGanancia}%</p>
            </div>
          </div>
        </section>

        {/* Acciones */}
        <div className="flex items-center justify-between">
          <div>
            {guardado && !hayDiferencias && (
              <p className="text-sm text-[#34c759] dark:text-[#30d158] font-medium">Configuracion guardada.</p>
            )}
            {hayDiferencias && (
              <p className="text-sm text-[#ff9500] dark:text-[#ff9f0a]">Cambios sin guardar.</p>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" disabled={!hayDiferencias}
              onClick={() => { if (config) { setForm(structuredClone(config)); setGuardado(false); } }}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-[#3a3a3c] rounded-xl hover:bg-gray-50 dark:hover:bg-[#2c2c2e] disabled:opacity-40 transition-colors">
              Descartar
            </button>
            <button type="submit" disabled={mutation.isPending || !hayDiferencias}
              className="px-5 py-2 text-sm font-medium text-white bg-[#007aff] dark:bg-[#0a84ff] hover:opacity-90 rounded-xl disabled:opacity-50 transition-opacity">
              {mutation.isPending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
