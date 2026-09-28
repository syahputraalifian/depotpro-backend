import React, { createContext, useContext, useEffect, useState } from "react";
import { router } from "expo-router";
import { storage } from "@/src/utils/storage";
import { api, TOKEN_KEY } from "@/src/api";

export type Role = "owner" | "cashier" | "warehouse_admin" | "driver";
export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  base_salary: number;
  incentive_rate: number;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await storage.secureGet<string>(TOKEN_KEY, "");
      if (token) {
        try {
          const me = await api.get("/auth/me");
          setUser(me);
        } catch {
          await storage.secureRemove(TOKEN_KEY);
        }
      }
      setLoading(false);
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await api.login(email, password);
    await storage.secureSet(TOKEN_KEY, res.access_token);
    setUser(res.user);
  };

  const signOut = async () => {
    // 1. wipe auth token from secure storage
    try { await storage.secureRemove(TOKEN_KEY); } catch {}
    // 2. reset global user state (owner/cashier/driver/warehouse)
    setUser(null);
    // 3. clean hard-redirect to the login screen
    router.replace("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
