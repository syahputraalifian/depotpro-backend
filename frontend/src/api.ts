import { storage } from "@/src/utils/storage";

const FALLBACK_URL = "https://depotpro-backend.onrender.com";
const rawBase = process.env.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_API_URL || FALLBACK_URL;

// Bersihkan trailing slash dan suffix /api jika ada
const BASE = rawBase.replace(/\/+$/, "").replace(/\/api$/, "");

export const TOKEN_KEY = "gg_access_token";

async function authHeaders(customHeaders?: Record<string, string>): Promise<Record<string, string>> {
  const token = await storage.secureGet<string>(TOKEN_KEY, "");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...customHeaders,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

async function handle(res: Response): Promise<any> {
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      await storage.secureRemove(TOKEN_KEY).catch(() => {});
    }

    const detail =
      (body && (body.detail || body.message || body.error)) ||
      `Request gagal dengan status ${res.status}`;
    throw new Error(typeof detail === "string" ? detail : "Terjadi kesalahan pada server");
  }

  return body;
}

function normalizePath(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${BASE}/api${cleanPath}`;
}

export const api = {
  async login(credentials: { email: string; password: string } | Record<string, any>) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    return handle(res);
  },

  async get(path: string, options?: RequestInit) {
    const res = await fetch(normalizePath(path), {
      method: "GET",
      ...options,
      headers: await authHeaders(options?.headers as Record<string, string>),
    });
    return handle(res);
  },

  async post(path: string, data?: any, options?: RequestInit) {
    const res = await fetch(normalizePath(path), {
      method: "POST",
      ...options,
      headers: await authHeaders(options?.headers as Record<string, string>),
      body: data ? JSON.stringify(data) : undefined,
    });
    return handle(res);
  },

  async put(path: string, data?: any, options?: RequestInit) {
    const res = await fetch(normalizePath(path), {
      method: "PUT",
      ...options,
      headers: await authHeaders(options?.headers as Record<string, string>),
      body: data ? JSON.stringify(data) : undefined,
    });
    return handle(res);
  },

  async patch(path: string, data?: any, options?: RequestInit) {
    const res = await fetch(normalizePath(path), {
      method: "PATCH",
      ...options,
      headers: await authHeaders(options?.headers as Record<string, string>),
      body: data ? JSON.stringify(data) : undefined,
    });
    return handle(res);
  },

  async del(path: string, options?: RequestInit) {
    const res = await fetch(normalizePath(path), {
      method: "DELETE",
      ...options,
      headers: await authHeaders(options?.headers as Record<string, string>),
    });
    return handle(res);
  },

  // Alias method 'delete' agar pemanggilan api.delete(...) bekerja persis seperti api.del(...)
  async delete(path: string, options?: RequestInit) {
    return this.del(path, options);
  },
};