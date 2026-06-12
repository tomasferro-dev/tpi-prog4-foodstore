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

// baseURL "/api/v1" → axios concatena el prefijo a cada path ("/auth/login" →
// "/api/v1/auth/login"). El proxy de Vite redirige "/api/v1" al backend.
// Funciona igual en localhost y vía ngrok sin cambiar nada.
export const apiClient = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.data) config.data = transformKeys(config.data, camelToSnake);
  if (config.params) config.params = transformKeys(config.params, camelToSnake);
  return config;
});

// ── Refresh de sesión transparente ──────────────────────────────────────────
// Ante un 401, intentamos renovar el access token con el refresh token y
// reintentamos la request original. Usamos un único refresh "en vuelo"
// (single-flight): si llegan varios 401 concurrentes, todos esperan el mismo
// refresh y se reintentan después.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return null;
  try {
    // axios "crudo" (sin interceptores) para no recursar ni transformar keys.
    const { data } = await axios.post("/api/v1/auth/refresh", { refresh_token: refreshToken });
    const accessToken: string = data.access_token;
    const nuevoRefresh: string = data.refresh_token ?? refreshToken;
    useAuthStore.getState().updateTokens({ accessToken, refreshToken: nuevoRefresh });
    return accessToken;
  } catch {
    return null;
  }
}

function getRefreshEnVuelo(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (res) => {
    const camel = transformKeys(res.data, snakeToCamel);
    res.data = renameKeys(camel, RESPONSE_RENAMES);
    return res;
  },
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const url: string = original?.url ?? "";
    const esAuthEndpoint = url.includes("/auth/refresh") || url.includes("/auth/login");

    if (status === 401 && original && !original._retry && !esAuthEndpoint) {
      original._retry = true;
      const nuevoToken = await getRefreshEnVuelo();
      if (nuevoToken) {
        // El request interceptor adjunta el nuevo token desde el authStore
        return apiClient(original);
      }
      useAuthStore.getState().logout();
    } else if (status === 401 && !esAuthEndpoint) {
      useAuthStore.getState().logout();
    }

    return Promise.reject(error.response?.data ?? error);
  }
);
