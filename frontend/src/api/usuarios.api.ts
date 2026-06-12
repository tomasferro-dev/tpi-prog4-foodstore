import { apiClient } from "./client";
import type {
  Usuario, RolPublic, AdminUsuarioCreateRequest, AdminUsuarioUpdateRequest,
} from "../types";

export const usuariosApi = {
  /** Lista todos los usuarios (solo ADMIN). */
  listar(): Promise<Usuario[]> {
    return apiClient.get<Usuario[]>("/auth/admin/usuarios").then((r) => r.data);
  },

  /** Crea un usuario con email/contraseña y le asigna roles (solo ADMIN). */
  crear(data: AdminUsuarioCreateRequest): Promise<Usuario> {
    return apiClient.post<Usuario>("/auth/admin/usuarios", data).then((r) => r.data);
  },

  /** Actualiza datos y/o roles de un usuario (solo ADMIN). */
  actualizar(id: number, data: AdminUsuarioUpdateRequest): Promise<Usuario> {
    return apiClient.patch<Usuario>(`/auth/admin/usuarios/${id}`, data).then((r) => r.data);
  },

  /** Baja lógica: marca el usuario como inactivo y revoca sus sesiones (solo ADMIN). */
  desactivar(id: number): Promise<Usuario> {
    return apiClient.post<Usuario>(`/auth/admin/usuarios/${id}/desactivar`).then((r) => r.data);
  },

  /** Reactiva un usuario dado de baja (solo ADMIN). */
  activar(id: number): Promise<Usuario> {
    return apiClient.post<Usuario>(`/auth/admin/usuarios/${id}/activar`).then((r) => r.data);
  },

  /** Catálogo de roles disponibles. */
  roles(): Promise<RolPublic[]> {
    return apiClient.get<RolPublic[]>("/auth/roles").then((r) => r.data);
  },
};
