import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMisPedidos } from "../api/pedidos.api";
import type { PedidoPublic } from "../types/pedidos";

const ESTADO_LABEL: Record<string, string> = {
  pendiente:       "Pendiente",
  confirmado:      "Confirmado",
  en_preparacion:  "En preparación",
  en_camino:       "En camino",
  entregado:       "Entregado",
  cancelado:       "Cancelado",
};

const ESTADO_COLOR: Record<string, string> = {
  pendiente:       "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  confirmado:      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  en_preparacion:  "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  en_camino:       "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  entregado:       "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelado:       "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const FORMA_PAGO_LABEL: Record<string, string> = {
  MERCADOPAGO:   "Mercado Pago",
  EFECTIVO:      "Efectivo",
  TRANSFERENCIA: "Transferencia",
};

const LIMITE = 6;

/** El backend devuelve datetimes sin 'Z'. Los forzamos a UTC para que
 *  toLocaleString los convierta correctamente a la hora local del browser. */
function parseUtc(iso: string): Date {
  return new Date(/Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + "Z");
}

export default function MisPedidosPage() {
  const [offset, setOffset] = useState(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mis-pedidos", offset],
    queryFn: () => getMisPedidos(offset, LIMITE),
  });

  // Ordenamos por fecha de creación descendente (más recientes primero),
  // igual que el backend, para que el orden sea consistente.
  const pedidos = [...(data?.data ?? [])].sort(
    (a, b) => parseUtc(b.creadoEn).getTime() - parseUtc(a.creadoEn).getTime()
  );
  const total   = data?.total ?? 0;
  const totalPaginas = Math.ceil(total / LIMITE);
  const paginaActual = Math.floor(offset / LIMITE) + 1;

  return (
    <div className="w-full p-4 md:p-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
        Mis Pedidos
      </h1>

      {isLoading && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-12">
          Cargando pedidos...
        </p>
      )}

      {isError && (
        <p className="text-center text-red-500 py-12">
          Error al cargar los pedidos.
        </p>
      )}

      {!isLoading && !isError && pedidos.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            Todavía no realizaste ningún pedido.
          </p>
        </div>
      )}

      {pedidos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pedidos.map((pedido: PedidoPublic) => (
            <div
              key={pedido.id}
              className="bg-white dark:bg-[#1c1c1e] rounded-xl shadow-sm border border-gray-100 dark:border-[#3a3a3c] p-5"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                {/* Número y fecha */}
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    Pedido #{pedido.id}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {parseUtc(pedido.creadoEn).toLocaleString("es-AR", {
                      day: "2-digit", month: "long", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>

                {/* Estado */}
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${ESTADO_COLOR[pedido.estadoCodigo] ?? "bg-gray-100 text-gray-700"}`}>
                  {ESTADO_LABEL[pedido.estadoCodigo] ?? pedido.estadoCodigo}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between flex-wrap gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span>
                  Forma de pago:{" "}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {FORMA_PAGO_LABEL[pedido.formaPagoCodigo] ?? pedido.formaPagoCodigo}
                  </span>
                </span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  ${Number(pedido.total).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            onClick={() => setOffset(Math.max(0, offset - LIMITE))}
            disabled={offset === 0}
            className="px-4 py-2 rounded-lg bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-[#3a3a3c] text-sm font-medium disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-[#2c2c2e] transition-colors"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Página {paginaActual} de {totalPaginas}
          </span>
          <button
            onClick={() => setOffset(offset + LIMITE)}
            disabled={paginaActual >= totalPaginas}
            className="px-4 py-2 rounded-lg bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-[#3a3a3c] text-sm font-medium disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-[#2c2c2e] transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
