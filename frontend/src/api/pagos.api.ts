import { apiClient } from "./client";

/**
 * Crea una preferencia de pago en Mercado Pago para el carrito activo del usuario.
 * Devuelve el init_point al que hay que redirigir al usuario para que pague.
 */
export async function crearPreferencia(pedidoId: number): Promise<string> {
  const { data } = await apiClient.post<{ initPoint: string }>("/pagos/preferencia", {
    pedidoId,
  });
  return data.initPoint;
}

export interface ConfirmarPagoResultado {
  pedidoId: number;
  estadoCodigo: string;
  mpStatus: string;
  confirmado: boolean;
}

/**
 * Verifica un pago contra Mercado Pago y, si está aprobado, confirma el pedido.
 * Se llama al volver de MP a /pago/success con el payment_id que adjunta MP.
 * La confirmación es autoritativa en el backend (no se confía en el front).
 */
export async function confirmarPago(paymentId: string | null): Promise<ConfirmarPagoResultado> {
  const { data } = await apiClient.post<ConfirmarPagoResultado>("/pagos/confirmar", { paymentId });
  return data;
}
