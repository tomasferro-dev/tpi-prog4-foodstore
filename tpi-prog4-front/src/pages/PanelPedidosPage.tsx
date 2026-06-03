import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTodosPedidos, avanzarEstadoPedido, getPedidoById } from "../api/pedidos.api";
import type { PedidoPublic, PedidoConDetalle, EstadoPedidoCodigo } from "../types/pedidos";

// ── Constantes de UI ──────────────────────────────────────────────────────────

const ESTADO_LABEL: Record<string, string> = {
  pendiente:      "Pendiente",
  confirmado:     "Confirmado",
  en_preparacion: "En preparación",
  en_camino:      "En camino",
  entregado:      "Entregado",
  cancelado:      "Cancelado",
};

const ESTADO_COLOR: Record<string, string> = {
  pendiente:      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  confirmado:     "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  en_preparacion: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  en_camino:      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  entregado:      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelado:      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const FORMA_PAGO_LABEL: Record<string, string> = {
  MERCADOPAGO:   "Mercado Pago",
  EFECTIVO:      "Efectivo",
  TRANSFERENCIA: "Transferencia",
};

/** Próximo estado según FSM (solo avance lineal) */
const NEXT_ESTADO: Partial<Record<string, EstadoPedidoCodigo>> = {
  confirmado:     "en_preparacion",
  en_preparacion: "en_camino",
  en_camino:      "entregado",
};

const NEXT_BTN_LABEL: Record<string, string> = {
  confirmado:     "Iniciar preparación",
  en_preparacion: "Despachar",
  en_camino:      "Marcar entregado",
};

/** Estados desde los que se puede cancelar */
const CANCELABLE = new Set(["pendiente", "confirmado", "en_preparacion"]);

const TABS: { label: string; value: string | undefined }[] = [
  { label: "Todos",           value: undefined },
  { label: "Confirmados",     value: "confirmado" },
  { label: "En preparación",  value: "en_preparacion" },
  { label: "En camino",       value: "en_camino" },
  { label: "Entregados",      value: "entregado" },
  { label: "Cancelados",      value: "cancelado" },
];

const LIMITE = 15;

function parseUtc(iso: string): Date {
  return new Date(/Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + "Z");
}

function fmt(iso: string) {
  return parseUtc(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function money(val: number | string) {
  return `$${Number(val).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
}

// ── Modal de detalle ──────────────────────────────────────────────────────────

function DetalleModal({
  pedidoId,
  onClose,
}: {
  pedidoId: number;
  onClose: () => void;
}) {
  const { data: pedido, isLoading, isError } = useQuery<PedidoConDetalle>({
    queryKey: ["pedido-detalle", pedidoId],
    queryFn: () => getPedidoById(pedidoId),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">

        {/* Cabecera fija */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-100 dark:border-[#3a3a3c]">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Pedido #{pedidoId}
            </h2>
            {pedido && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {fmt(pedido.creadoEn)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {/* Cuerpo scrolleable */}
        <div className="overflow-y-auto p-6 space-y-6">

          {isLoading && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              Cargando detalle…
            </p>
          )}
          {isError && (
            <p className="text-center text-red-500 py-8">
              Error al cargar el detalle.
            </p>
          )}

          {pedido && (
            <>
              {/* Info general */}
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                <span>
                  Estado:{" "}
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_COLOR[pedido.estadoCodigo] ?? ""}`}>
                    {ESTADO_LABEL[pedido.estadoCodigo] ?? pedido.estadoCodigo}
                  </span>
                </span>
                <span>
                  Cliente:{" "}
                  <span className="font-medium text-gray-900 dark:text-white">#{pedido.usuarioId}</span>
                </span>
                <span>
                  Pago:{" "}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {FORMA_PAGO_LABEL[pedido.formaPagoCodigo] ?? pedido.formaPagoCodigo}
                  </span>
                </span>
                {pedido.direccionId && (
                  <span>
                    Dirección:{" "}
                    <span className="font-medium text-gray-900 dark:text-white">#{pedido.direccionId}</span>
                  </span>
                )}
                {!pedido.direccionId && (
                  <span className="text-gray-500 dark:text-gray-400 italic">Retiro en local</span>
                )}
                {pedido.notas && (
                  <span className="w-full italic">
                    Notas: <span className="not-italic text-gray-900 dark:text-white">{pedido.notas}</span>
                  </span>
                )}
              </div>

              {/* Productos */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Productos
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-[#3a3a3c]">
                        <th className="text-left pb-2 font-medium text-gray-500 dark:text-gray-400">Producto</th>
                        <th className="text-center pb-2 font-medium text-gray-500 dark:text-gray-400">Cant.</th>
                        <th className="text-right pb-2 font-medium text-gray-500 dark:text-gray-400">P. unitario</th>
                        <th className="text-right pb-2 font-medium text-gray-500 dark:text-gray-400">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-[#2c2c2e]">
                      {pedido.items.map((item) => (
                        <tr key={item.productoId}>
                          <td className="py-2.5 pr-4 text-gray-900 dark:text-white font-medium">
                            {item.nombreSnapshot}
                            {item.personalizacion && item.personalizacion.length > 0 && (
                              <span className="block text-xs text-gray-400 dark:text-gray-500 font-normal mt-0.5">
                                Sin ingredientes: {item.personalizacion.join(", ")}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-center text-gray-700 dark:text-gray-300">
                            {item.cantidad}
                          </td>
                          <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">
                            {money(item.precioSnapshot)}
                          </td>
                          <td className="py-2.5 text-right font-semibold text-gray-900 dark:text-white">
                            {money(item.subtotalSnap)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Resumen financiero */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#3a3a3c] space-y-1 text-sm">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Subtotal</span>
                    <span>{money(pedido.subtotal)}</span>
                  </div>
                  {Number(pedido.descuento) > 0 && (
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>Descuento</span>
                      <span>-{money(pedido.descuento)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Envío</span>
                    <span>
                      {Number(pedido.costoEnvio) === 0
                        ? <span className="text-green-600 dark:text-green-400">Gratis</span>
                        : money(pedido.costoEnvio)
                      }
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-gray-900 dark:text-white pt-1 border-t border-gray-200 dark:border-[#3a3a3c]">
                    <span>Total</span>
                    <span>{money(pedido.total)}</span>
                  </div>
                </div>
              </div>

              {/* Historial de estados */}
              {pedido.historial.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                    Historial de estados
                  </h3>
                  <ol className="relative border-l border-gray-200 dark:border-[#3a3a3c] ml-2 space-y-4">
                    {/* Deduplicar entradas con mismo estadoDesde → estadoHacia
                        (pueden existir duplicados por doble-mount en Strict Mode) */}
                    {pedido.historial
                      .filter((h, idx, arr) =>
                        arr.findIndex(
                          (x) => x.estadoDesde === h.estadoDesde && x.estadoHacia === h.estadoHacia
                        ) === idx
                      )
                      .map((h) => (
                      <li key={h.id} className="ml-4">
                        {/* Punto en la línea */}
                        <span className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-[#1c1c1e] bg-gray-400 dark:bg-gray-500" />

                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_COLOR[h.estadoHacia] ?? "bg-gray-100 text-gray-700"}`}>
                            {ESTADO_LABEL[h.estadoHacia] ?? h.estadoHacia}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {fmt(h.creadoEn)}
                          </span>
                        </div>

                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {h.estadoDesde
                            ? `← desde ${ESTADO_LABEL[h.estadoDesde] ?? h.estadoDesde}`
                            : "Creación del pedido"}
                          {" · "}
                          {h.usuarioNombre
                            ?? (h.usuarioId ? `usuario #${h.usuarioId}` : "Sistema")}
                        </p>

                        {h.motivo && (
                          <p className="mt-0.5 text-xs italic text-red-600 dark:text-red-400">
                            Motivo: {h.motivo}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </div>

        {/* Pie fijo */}
        <div className="p-4 border-t border-gray-100 dark:border-[#3a3a3c] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-gray-100 dark:bg-[#2c2c2e] text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-[#3a3a3c] transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panel principal ───────────────────────────────────────────────────────────

type CancelarModal = { pedidoId: number; motivo: string };

export default function PanelPedidosPage() {
  const qc = useQueryClient();

  const [filtro, setFiltro]       = useState<string | undefined>("confirmado");
  const [offset, setOffset]       = useState(0);
  const [cancelar, setCancelar]   = useState<CancelarModal | null>(null);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [errMsg, setErrMsg]       = useState<string | null>(null);

  // ── Query lista ──
  const { data, isLoading, isError } = useQuery({
    queryKey: ["panel-pedidos", filtro, offset],
    queryFn: () => getTodosPedidos(offset, LIMITE, filtro),
  });

  const pedidos      = data?.data ?? [];
  const total        = data?.total ?? 0;
  const totalPags    = Math.ceil(total / LIMITE);
  const paginaActual = Math.floor(offset / LIMITE) + 1;

  // ── Mutations ──
  const invalidar = () => qc.invalidateQueries({ queryKey: ["panel-pedidos"] });

  const avanzarMut = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: EstadoPedidoCodigo }) =>
      avanzarEstadoPedido(id, { estadoHacia: estado }),
    onSuccess: () => {
      invalidar();
      // refrescar el detalle si estaba abierto
      if (detalleId) qc.invalidateQueries({ queryKey: ["pedido-detalle", detalleId] });
    },
    onError: (e: { detail?: string }) =>
      setErrMsg(e?.detail ?? "Error al cambiar el estado"),
  });

  const cancelarMut = useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: string }) =>
      avanzarEstadoPedido(id, { estadoHacia: "cancelado", motivo }),
    onSuccess: () => {
      invalidar();
      if (detalleId) qc.invalidateQueries({ queryKey: ["pedido-detalle", detalleId] });
      setCancelar(null);
    },
    onError: (e: { detail?: string }) =>
      setErrMsg(e?.detail ?? "Error al cancelar el pedido"),
  });

  // ── Handlers ──
  const handleFiltro = (v: string | undefined) => {
    setFiltro(v);
    setOffset(0);
    setErrMsg(null);
  };

  const handleAvanzar = (pedido: PedidoPublic) => {
    const sig = NEXT_ESTADO[pedido.estadoCodigo];
    if (!sig) return;
    setErrMsg(null);
    avanzarMut.mutate({ id: pedido.id, estado: sig });
  };

  const handleCancelarConfirm = () => {
    if (!cancelar) return;
    if (!cancelar.motivo.trim()) {
      setErrMsg("El motivo es obligatorio para cancelar");
      return;
    }
    setErrMsg(null);
    cancelarMut.mutate({ id: cancelar.pedidoId, motivo: cancelar.motivo.trim() });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
        Panel de Pedidos
      </h1>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => handleFiltro(tab.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filtro === tab.value
                ? "bg-[#007aff] dark:bg-[#0a84ff] text-white"
                : "bg-gray-100 dark:bg-[#2c2c2e] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#3a3a3c]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error de mutación */}
      {errMsg && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {errMsg}
        </div>
      )}

      {/* Estados de carga */}
      {isLoading && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-12">Cargando pedidos…</p>
      )}
      {isError && (
        <p className="text-center text-red-500 py-12">Error al cargar los pedidos.</p>
      )}
      {!isLoading && !isError && pedidos.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            No hay pedidos{filtro ? ` en estado "${ESTADO_LABEL[filtro]}"` : ""}.
          </p>
        </div>
      )}

      {/* Lista */}
      {pedidos.length > 0 && (
        <div className="space-y-4">
          {pedidos.map((pedido: PedidoPublic) => {
            const sigEstado    = NEXT_ESTADO[pedido.estadoCodigo];
            const puedeAvanzar = !!sigEstado;
            const puedeCancelar = CANCELABLE.has(pedido.estadoCodigo);
            const avanMutando  = avanzarMut.isPending && avanzarMut.variables?.id === pedido.id;

            return (
              <div
                key={pedido.id}
                className="bg-white dark:bg-[#1c1c1e] rounded-xl shadow-sm border border-gray-100 dark:border-[#3a3a3c] p-5"
              >
                {/* Cabecera */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      Pedido #{pedido.id}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {fmt(pedido.creadoEn)}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${ESTADO_COLOR[pedido.estadoCodigo] ?? "bg-gray-100 text-gray-700"}`}>
                    {ESTADO_LABEL[pedido.estadoCodigo] ?? pedido.estadoCodigo}
                  </span>
                </div>

                {/* Info resumida */}
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <span>
                    Cliente:{" "}
                    <span className="font-medium text-gray-900 dark:text-white">#{pedido.usuarioId}</span>
                  </span>
                  <span>
                    Pago:{" "}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {FORMA_PAGO_LABEL[pedido.formaPagoCodigo] ?? pedido.formaPagoCodigo}
                    </span>
                  </span>
                  {pedido.notas && (
                    <span className="w-full italic text-gray-500 dark:text-gray-400">
                      Notas: {pedido.notas}
                    </span>
                  )}
                </div>

                {/* Total + acciones */}
                <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {money(pedido.total)}
                  </span>

                  <div className="flex flex-wrap gap-2">
                    {/* Ver detalle */}
                    <button
                      onClick={() => setDetalleId(pedido.id)}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-[#3a3a3c] text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2c2c2e] transition-colors"
                    >
                      Ver detalle
                    </button>

                    {/* Cancelar */}
                    {puedeCancelar && (
                      <button
                        onClick={() => { setErrMsg(null); setCancelar({ pedidoId: pedido.id, motivo: "" }); }}
                        disabled={avanMutando}
                        className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 transition-colors"
                      >
                        Cancelar
                      </button>
                    )}

                    {/* Avanzar estado */}
                    {puedeAvanzar && (
                      <button
                        onClick={() => handleAvanzar(pedido)}
                        disabled={avanMutando}
                        className="px-3 py-1.5 rounded-lg bg-[#007aff] dark:bg-[#0a84ff] text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
                      >
                        {avanMutando ? "Guardando…" : NEXT_BTN_LABEL[pedido.estadoCodigo]}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Paginación */}
      {totalPags > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            onClick={() => setOffset(Math.max(0, offset - LIMITE))}
            disabled={offset === 0}
            className="px-4 py-2 rounded-lg bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-[#3a3a3c] text-sm font-medium disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-[#2c2c2e] transition-colors"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Página {paginaActual} de {totalPags}
          </span>
          <button
            onClick={() => setOffset(offset + LIMITE)}
            disabled={paginaActual >= totalPags}
            className="px-4 py-2 rounded-lg bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-[#3a3a3c] text-sm font-medium disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-[#2c2c2e] transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Modal de detalle */}
      {detalleId !== null && (
        <DetalleModal pedidoId={detalleId} onClose={() => setDetalleId(null)} />
      )}

      {/* Modal de cancelación */}
      {cancelar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Cancelar pedido #{cancelar.pedidoId}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Esta acción es irreversible. El pedido pasará al estado{" "}
              <span className="font-semibold text-red-600 dark:text-red-400">Cancelado</span>.
            </p>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Motivo <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={cancelar.motivo}
              onChange={(e) => setCancelar({ ...cancelar, motivo: e.target.value })}
              placeholder="Ej: cliente solicitó cancelación, error en el pedido…"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] text-gray-900 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#007aff]"
            />

            {errMsg && <p className="mt-2 text-sm text-red-500">{errMsg}</p>}

            <div className="mt-4 flex gap-3 justify-end">
              <button
                onClick={() => { setCancelar(null); setErrMsg(null); }}
                disabled={cancelarMut.isPending}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-[#3a3a3c] text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2c2c2e] disabled:opacity-40 transition-colors"
              >
                Volver
              </button>
              <button
                onClick={handleCancelarConfirm}
                disabled={cancelarMut.isPending || !cancelar.motivo.trim()}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-40 transition-colors"
              >
                {cancelarMut.isPending ? "Cancelando…" : "Confirmar cancelación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
