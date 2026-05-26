import { apiClient } from "./client";
import type { ConfigPrecio } from "../types";

export const configApi = {
  obtener(): Promise<ConfigPrecio> {
    return apiClient.get<ConfigPrecio>("/admin/config/precios").then(r => r.data);
  },

  actualizar(data: Partial<ConfigPrecio>): Promise<ConfigPrecio> {
    return apiClient.patch<ConfigPrecio>("/admin/config/precios", data).then(r => r.data);
  },
};
