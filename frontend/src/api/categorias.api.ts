import { apiClient } from "./client";
import type { Categoria } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCategoria(c: any): Categoria {
  // El interceptor ya convirtió snake_case→camelCase y deletedAt→eliminadoEn.
  // Solo necesitamos renombrar parentId → padreId.
  const { parentId, ...rest } = c;
  return { ...rest, padreId: parentId ?? null };
}

export interface CategoriaFormData {
  nombre: string;
  descripcion: string | null;
  imagenUrl: string | null;
  padreId: number | null;
}

export const categoriasApi = {
  /** Lista pública (sin auth). Con include_deleted para la vista admin. */
  listar(incluirEliminados = false): Promise<Categoria[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return apiClient
      .get<any[]>("/categorias", {
        params: incluirEliminados ? { include_deleted: true } : {},
      })
      .then(r => r.data.map(mapCategoria));
  },

  /** Crea una categoría (requiere ADMIN). */
  crear(data: CategoriaFormData): Promise<Categoria> {
    // Enviamos parentId (no padreId) para que el interceptor lo convierta a parent_id.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return apiClient.post<any>("/categorias", {
      nombre: data.nombre,
      descripcion: data.descripcion,
      imagenUrl: data.imagenUrl,
      parentId: data.padreId,
    }).then(r => mapCategoria(r.data));
  },

  /** Edita parcialmente una categoría (requiere ADMIN). */
  editar(id: number, data: Partial<CategoriaFormData>): Promise<Categoria> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: Record<string, unknown> = {};
    if (data.nombre !== undefined)      body.nombre     = data.nombre;
    if (data.descripcion !== undefined) body.descripcion = data.descripcion;
    if (data.imagenUrl !== undefined)   body.imagenUrl  = data.imagenUrl;
    // padreId → parentId para que el interceptor lo mande como parent_id
    if (data.padreId !== undefined)     body.parentId   = data.padreId;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return apiClient.patch<any>(`/categorias/${id}`, body).then(r => mapCategoria(r.data));
  },

  /** Soft-delete (requiere ADMIN). Falla 422 si tiene hijos activos. */
  eliminar(id: number): Promise<void> {
    return apiClient.delete(`/categorias/${id}`).then(() => undefined);
  },

  /** Reactiva una categoría dada de baja (requiere ADMIN). */
  reactivar(id: number): Promise<Categoria> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return apiClient.post<any>(`/categorias/${id}/reactivar`).then(r => mapCategoria(r.data));
  },
};
