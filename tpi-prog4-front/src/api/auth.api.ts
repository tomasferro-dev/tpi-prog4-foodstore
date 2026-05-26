import { apiClient } from "./client";
import { useAuthStore } from "../stores/authStore";
import type { LoginRequest, LoginResponse, RegisterRequest } from "../types";

export const authApi = {
  login(data: LoginRequest): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>("/auth/login", data).then(r => r.data);
  },

  registro(data: RegisterRequest): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>("/auth/registro", data).then(r => r.data);
  },

  logout(): Promise<void> {
    const refreshToken = useAuthStore.getState().refreshToken;
    return apiClient
      .post("/auth/logout", { refreshToken })
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => useAuthStore.getState().logout());
  },
};
