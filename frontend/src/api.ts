import { storage } from "@/src/utils/storage";

const FALLBACK_URL = "https://depotpro-backend.onrender.com";
const rawBase = process.env.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_API_URL || FALLBACK_URL;

const BASE = rawBase.replace(/\/+$/, "");

export const TOKEN_KEY = "gg_access_token";

async function authHeaders(): Promise<Record<string, string>> {
  const token = await storage.secureGet<string>(TOKEN_KEY, "");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function handle(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (body && (body.detail || body.message)) || `Gagal (${res.status})`;
    throw new Error(typeof detail === "string" ? detail : "Terjadi kesalahan");
  }
  return body;
}

export const api = {
  async login(email: string, password: string) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return handle(res);
  },
  async get(path: string) {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const res = await fetch(`${BASE}/api${cleanPath}`, { headers: await authHeaders() });
    return handle(res);
  },
  async post(path: string, data?: any) {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const res = await fetch(`${BASE}/api${cleanPath}`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(data ?? {}),
    });
    return handle(res);
  },
  async put(path: string, data?: any) {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const res = await fetch(`${BASE}/api${cleanPath}`, {
      method: "PUT",
      headers: await authHeaders(),
      body: JSON.stringify(data ?? {}),
    });
    return handle(res);
  },
  async del(path: string) {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const res = await fetch(`${BASE}/api${cleanPath}`, {
      method: "DELETE",
      headers: await authHeaders(),
    });
    return handle(res);
  },
  // ALIAS AGAR 'api.delete' BERJALAN 100% SAMA DENGAN 'api.del'
  async delete(path: string) {
    return this.del(path);
  }
};