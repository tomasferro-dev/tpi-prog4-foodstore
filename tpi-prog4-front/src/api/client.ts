import axios from "axios";
import { useAuthStore } from "../stores/authStore";

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, c => "_" + c.toLowerCase());
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function transformKeys(obj: unknown, fn: (k: string) => string): unknown {
  if (Array.isArray(obj)) return obj.map(v => transformKeys(v, fn));
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [fn(k), transformKeys(v, fn)])
    );
  }
  return obj;
}

function renameKeys(obj: unknown, map: Record<string, string>): unknown {
  if (Array.isArray(obj)) return obj.map(v => renameKeys(v, map));
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        map[k] ?? k,
        renameKeys(v, map),
      ])
    );
  }
  return obj;
}

// Timestamps rename: English camelCase → Spanish camelCase (applied globally to all responses)
const RESPONSE_RENAMES: Record<string, string> = {
  createdAt: "creadoEn",
  updatedAt: "actualizadoEn",
  deletedAt: "eliminadoEn",
};

export const apiClient = axios.create({
  baseURL: "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.data) config.data = transformKeys(config.data, camelToSnake);
  if (config.params) config.params = transformKeys(config.params, camelToSnake);
  return config;
});

apiClient.interceptors.response.use(
  (res) => {
    const camel = transformKeys(res.data, snakeToCamel);
    res.data = renameKeys(camel, RESPONSE_RENAMES);
    return res;
  },
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error.response?.data ?? error);
  }
);
