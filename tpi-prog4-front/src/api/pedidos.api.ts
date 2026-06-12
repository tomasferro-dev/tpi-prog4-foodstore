import { apiClient } from "./client";
import type {
  PedidoConDetalle,
  PedidoList,
  EstadoPedido,
  FormaPago,
  ItemPedidoRequest,
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

// ====== Carrito (solo CLIENT) ======

export async function getCarritoActual(): Promise<PedidoConDetalle | null> {
  const { data } = await apiClient.get<PedidoConDetalle | null>("/pedidos/actual");
  return data;
}

export async function agregarAlCarrito(
  item: ItemPedidoRequest
): Promise<PedidoConDetalle> {
  const { data } = await apiClient.post<PedidoConDetalle>("/pedidos/items", item);
  return data;
}

export async function actualizarItemCarrito(
  productoId: number,
  cantidad: number
): Promise<PedidoConDetalle> {
  const { data } = await apiClient.post<PedidoConDetalle>(
    "/pedidos/items",
    {
      productoId,
      cantidad,
    }
  );
  return data;
}

export async function eliminarDelCarrito(
  productoId: number
): Promise<PedidoConDetalle | null> {
  const { data } = await apiClient.delete<PedidoConDetalle | null>(
    `/pedidos/items/${productoId}`
  );
  return data;
}

// ====== Pedidos del usuario ======

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

export async function avanzarEstadoPedido(
  pedidoId: number,
  request: AvanzarEstadoRequest
): Promise<PedidoConDetalle> {
  const { data } = await apiClient.post<PedidoConDetalle>(
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

// ====== Admin (solo ADMIN/PEDIDOS) ======

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
