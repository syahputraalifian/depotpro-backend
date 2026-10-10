import React, { useEffect, useState } from "react";
import { Redirect, Tabs } from "expo-router";
import { storage } from "@/src/utils/storage";
import { TOKEN_KEY } from "@/src/api";
import Icon from "@react-native-vector-icons/ionicons";
import { useTheme } from "@/src/theme";

export default function TabLayout() {
  const { colors } = useTheme();
  const [session, setSession] = useState<"loading" | "in" | "out">("loading");
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    (async () => {
      const token = await storage.secureGet<string>(TOKEN_KEY, "");
      const r = await storage.secureGet<string>("user_role", "");
      setRole(String(r || "").toLowerCase());
      setSession(token ? "in" : "out");
    })();
  }, []);

  if (session === "out") return <Redirect href="/login" />;
  if (session === "loading") return null;

  // Tab yang boleh dilihat tiap peran (server tetap memeriksa hak akses)
  const allowed: Record<string, string[]> = {
    owner: ["index", "pos", "stok", "pelanggan", "driver", "laporan", "setoran"],
    cashier: ["index", "pos", "pelanggan", "laporan", "setoran"],
    warehouse_admin: ["stok"],
    driver: ["driver", "setoran"],
  };
  const visible = allowed[role] || allowed.owner;
  const hide = (name: string) => (visible.includes(name) ? undefined : null);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary || "#0284c7",
        tabBarInactiveTintColor: colors.muted || "#94a3b8",
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: hide("index"),
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <Icon name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pos"
        options={{
          href: hide("pos"),
          title: "Kasir",
          tabBarIcon: ({ color, size }) => <Icon name="cart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stok"
        options={{
          href: hide("stok"),
          title: "Stok",
          tabBarIcon: ({ color, size }) => <Icon name="cube-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pelanggan"
        options={{
          href: hide("pelanggan"),
          title: "Pelanggan",
          tabBarIcon: ({ color, size }) => <Icon name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="driver"
        options={{
          href: hide("driver"),
          title: "Driver",
          tabBarIcon: ({ color, size }) => <Icon name="bicycle-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="laporan"
        options={{
          href: hide("laporan"),
          title: "Laporan",
          tabBarIcon: ({ color, size }) => <Icon name="document-text-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="setoran"
        options={{
          href: hide("setoran"),
          title: "Setoran",
          tabBarIcon: ({ color, size }) => <Icon name="wallet-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}