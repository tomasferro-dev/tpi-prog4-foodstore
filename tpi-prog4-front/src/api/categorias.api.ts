import { apiClient } from "./client";
import type { Categoria } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCategoria(c: any): Categoria {
  const { parentId, ...rest } = c;
  return { ...rest, padreId: parentId ?? null };
}

export const categoriasApi = {
  listar(): Promise<Categoria[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return apiClient.get<any[]>("/categorias").then(r => r.data.map(mapCategoria));
  },
};
