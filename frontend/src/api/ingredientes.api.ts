import { apiClient } from "./client";
import type { FiltrosIngredientes, Ingrediente, Paginado } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapIngrediente(i: any): Ingrediente {
  const { stockCantidad, precioPorUnidad, ...rest } = i;
  return {
    ...rest,
    stockDisponible: stockCantidad ?? 0,
    costoUnitario: precioPorUnidad ?? 0,
  };
}

// Renames Spanish frontend fields to the English field names the backend expects.
// The global request interceptor then converts camelCase → snake_case.
function outbound(
  data: Partial<Omit<Ingrediente, "id" | "creadoEn" | "actualizadoEn" | "eliminadoEn">>
) {
  const { stockDisponible, costoUnitario, ...rest } = data;
  return {
    ...rest,
    ...(stockDisponible !== undefined && { stockCantidad: stockDisponible }),
    ...(costoUnitario !== undefined && { precioPorUnidad: costoUnitario }),
  };
}

function toBackendParams(filtros: FiltrosIngredientes) {
  const { skip, esAlergeno, incluirEliminados, ...rest } = filtros;
  return {
    ...rest,
    offset: skip ?? 0,
    ...(esAlergeno !== undefined && { es_alergeno: esAlergeno }),
    ...(incluirEliminados !== undefined && { include_deleted: incluirEliminados }),
  };
}

export const ingredientesApi = {
  listar(filtros: FiltrosIngredientes = {}): Promise<Paginado<Ingrediente>> {
    return apiClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .get<any>("/admin/insumos", { params: toBackendParams(filtros) })
      .then(r => ({ ...r.data, items: r.data.items.map(mapIngrediente) }));
  },

  obtener(id: number): Promise<Ingrediente> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return apiClient.get<any>(`/admin/insumos/${id}`).then(r => mapIngrediente(r.data));
  },

  crear(
    data: Omit<Ingrediente, "id" | "creadoEn" | "actualizadoEn" | "eliminadoEn">
  ): Promise<Ingrediente> {
    return apiClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .post<any>("/admin/insumos", outbound(data))
      .then(r => mapIngrediente(r.data));
  },

  editar(
    id: number,
    data: Partial<Omit<Ingrediente, "id" | "creadoEn" | "actualizadoEn" | "eliminadoEn">>
  ): Promise<Ingrediente> {
    return apiClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .patch<any>(`/admin/insumos/${id}`, outbound(data))
      .then(r => mapIngrediente(r.data));
  },

  eliminar(id: number): Promise<void> {
    return apiClient.delete(`/admin/insumos/${id}`).then(() => undefined);
  },

  reactivar(id: number): Promise<Ingrediente> {
    return apiClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .post<any>(`/admin/insumos/${id}/reactivar`)
      .then(r => mapIngrediente(r.data));
  },
};
