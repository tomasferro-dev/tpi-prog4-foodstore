import { apiClient } from "./client";

/**
 * Crea una preferencia de pago en Mercado Pago para el carrito activo del usuario.
 * Devuelve el init_point al que hay que redirigir al usuario para que pague.
 */
export async function crearPreferencia(): Promise<string> {
  const { data } = await apiClient.post<{ initPoint: string }>("/pagos/preferencia");
  return data.initPoint;
}
