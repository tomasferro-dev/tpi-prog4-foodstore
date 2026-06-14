import { apiClient } from "./client";
import type {
  PedidoConDetalle,
  PedidoList,
  EstadoPedido,
  FormaPago,
  PedidoCreateRequest,
  AvanzarEstadoRequest,
  DashboardResumen,
} from "../types/pedidos";

// ====== Catálogos ======

export async function getEstadosPedido(): Promise<EstadoPedido[]> {
  const { data } = await apiClient.get<EstadoPedido[]>("/pedidos/estados");
  return data;
}

export async function getFormasPago(): Promise<FormaPago[]> {
  const { data } = await apiClient.get<FormaPago[]>("/pedidos/formas-pago");
  return data;
}

// ====== Pedidos del usuario ======

/** Crea el pedido (pendiente) a partir de los items del carrito client-side (RN-CR01). */
export async function crearPedido(data: PedidoCreateRequest): Promise<PedidoConDetalle> {
  const { data: res } = await apiClient.post<PedidoConDetalle>("/pedidos/", data);
  return res;
}

export async function getMisPedidos(
  offset: number = 0,
  limit: number = 20
): Promise<PedidoList> {
  const { data } = await apiClient.get<PedidoList>("/pedidos", {
    params: { offset, limit },
  });
  return data;
}

export async function getPedidoById(pedidoId: number): Promise<PedidoConDetalle> {
  const { data } = await apiClient.get<PedidoConDetalle>(`/pedidos/${pedidoId}`);
  return data;
}

/** Cancela un pedido propio (CLIENT). Solo PENDIENTE o CONFIRMADO. */
export async function cancelarPedido(pedidoId: number, motivo: string): Promise<PedidoConDetalle> {
  const { data } = await apiClient.delete<PedidoConDetalle>(`/pedidos/${pedidoId}`, {
    data: { motivo },
  });
  return data;
}

// ====== Admin / Pedidos (ADMIN/PEDIDOS) ======

export async function avanzarEstadoPedido(
  pedidoId: number,
  request: AvanzarEstadoRequest
): Promise<PedidoConDetalle> {
  const { data } = await apiClient.patch<PedidoConDetalle>(
    `/pedidos/${pedidoId}/estado`,
    request
  );
  return data;
}

export async function revertirEstadoPedido(
  pedidoId: number
): Promise<PedidoConDetalle> {
  const { data } = await apiClient.post<PedidoConDetalle>(
    `/pedidos/${pedidoId}/revertir`
  );
  return data;
}

export async function getTodosPedidos(
  offset: number = 0,
  limit: number = 20,
  estado?: string
): Promise<PedidoList> {
  const { data } = await apiClient.get<PedidoList>("/pedidos/admin/todos", {
    params: { offset, limit, ...(estado ? { estado } : {}) },
  });
  return data;
}

export async function getDashboardAdmin(): Promise<DashboardResumen> {
  const { data } = await apiClient.get<DashboardResumen>("/pedidos/admin/dashboard");
  return data;
}
