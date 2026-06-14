import { apiClient } from "./client";

export interface Direccion {
  id: number;
  usuarioId: number;
  alias: string | null;
  linea1: string;
  linea2: string | null;
  ciudad: string;
  provincia: string | null;
  codigoPostal: string | null;
  esPrincipal: boolean;
  creadoEn: string;
}

export interface DireccionFormData {
  alias: string | null;
  linea1: string;
  linea2: string | null;
  ciudad: string;
  provincia: string | null;
  codigoPostal: string | null;
  esPrincipal: boolean;
}

// El interceptor de Axios convierte camelCase↔snake_case automáticamente,
// así que del lado del front trabajamos siempre en camelCase.
export const direccionesApi = {
  /** Lista las direcciones del usuario logueado. */
  listar(): Promise<Direccion[]> {
    return apiClient
      .get<{ data: Direccion[]; total: number }>("/direcciones")
      .then(r => r.data.data);
  },

  crear(data: DireccionFormData): Promise<Direccion> {
    return apiClient.post<Direccion>("/direcciones", data).then(r => r.data);
  },

  editar(id: number, data: Partial<DireccionFormData>): Promise<Direccion> {
    return apiClient.patch<Direccion>(`/direcciones/${id}`, data).then(r => r.data);
  },

  eliminar(id: number): Promise<void> {
    return apiClient.delete(`/direcciones/${id}`).then(() => undefined);
  },
};
