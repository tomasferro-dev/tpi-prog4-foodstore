import { useQuery } from "@tanstack/react-query";
import { getDashboardAdmin } from "../api/pedidos.api";
import type { DashboardResumen } from "../types/pedidos";

// ── Etiquetas de UI ─────────────────────────────────────────────────────────

const ESTADO_LABEL: Record<string, string> = {
  pendiente:      "Pendiente",
  confirmado:     "Confirmado",
  en_preparacion: "En preparación",
  en_camino:      "En camino",
  entregado:      "Entregado",
  cancelado:      "Cancelado",
};

const ESTADO_COLOR: Record<string, string> = {
  confirmado:     "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  en_preparacion: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  en_camino:      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  entregado:      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelado:      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const FORMA_PAGO_LABEL: Record<string, string> = {
  MERCADOPAGO:   "Mercado Pago",
  EFECTIVO:      "Retiro en local",
  TRANSFERENCIA: "Transferencia",
};

function parseUtc(iso: string): Date {
  return new Date(/Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + "Z");
}

function fmt(iso: string) {
  return parseUtc(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function money(val: number | string) {
  return `$${Number(val).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function DashboardAdminPage() {
  const { data, isLoading, isError } = useQuery<DashboardResumen>({
    queryKey: ["admin-dashboard"],
    queryFn: getDashboardAdmin,
  });

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Panel de Administrador</h1>
        <p className="text-gray-500 dark:text-gray-400">Pedidos generados e ingresos del negocio.</p>
      </header>

      {isLoading && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-12">Cargando resumen…</p>
      )}
      {isError && (
        <p className="text-center text-[#ff3b30] dark:text-[#ff453a] py-12">Error al cargar el resumen.</p>
      )}

      {data && (
        <>
          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-[#3a3a3c] rounded-2xl p-5 shadow-sm">
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Pedidos generados
              </p>
              <p className="mt-2 text-4xl font-bold text-gray-900 dark:text-white">
                {data.totalPedidos}
              </p>
            </div>
            <div className="bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-[#3a3a3c] rounded-2xl p-5 shadow-sm">
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Ingresos totales
              </p>
              <p className="mt-2 text-4xl font-bold text-[#34c759] dark:text-[#30d158]">
                {money(data.ingresosTotal)}
              </p>
            </div>
          </div>

          {/* Tabla de pedidos */}
          <div className="bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-[#3a3a3c] rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-[#3a3a3c]">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Detalle de pedidos
              </h2>
            </div>

            {data.pedidos.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-12">
                Todavía no se generaron pedidos.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-[#3a3a3c] text-gray-500 dark:text-gray-400">
                      <th className="text-left font-medium px-5 py-3">Pedido</th>
                      <th className="text-left font-medium px-5 py-3">Fecha</th>
                      <th className="text-left font-medium px-5 py-3">Cliente</th>
                      <th className="text-left font-medium px-5 py-3">Pago</th>
                      <th className="text-left font-medium px-5 py-3">Estado</th>
                      <th className="text-right font-medium px-5 py-3">Ingreso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#2c2c2e]">
                    {data.pedidos.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-[#2c2c2e] transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">#{p.id}</td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmt(p.creadoEn)}</td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400">#{p.usuarioId}</td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                          {FORMA_PAGO_LABEL[p.formaPagoCodigo] ?? p.formaPagoCodigo}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_COLOR[p.estadoCodigo] ?? "bg-gray-100 text-gray-700"}`}>
                            {ESTADO_LABEL[p.estadoCodigo] ?? p.estadoCodigo}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                          {money(p.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 dark:border-[#3a3a3c] font-bold text-gray-900 dark:text-white">
                      <td className="px-5 py-3" colSpan={5}>Total ({data.totalPedidos} pedidos)</td>
                      <td className="px-5 py-3 text-right text-[#34c759] dark:text-[#30d158] whitespace-nowrap">
                        {money(data.ingresosTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
