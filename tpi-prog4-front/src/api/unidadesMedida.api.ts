import { apiClient } from "./client";
import type { UnidadMedida } from "../types";

export const unidadesMedidaApi = {
  listar(): Promise<UnidadMedida[]> {
    return apiClient.get<UnidadMedida[]>("/unidades-medida").then(r => r.data);
  },
};
