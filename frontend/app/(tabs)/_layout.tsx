import { Tabs, Redirect } from "expo-router";
import { Platform } from "react-native";
import Icon from "@react-native-vector-icons/ionicons";
import { useTheme } from "@/src/theme";
import { useAuth, Role } from "@/src/auth/AuthContext";

const VISIBILITY: Record<string, Role[]> = {
  index: ["owner", "cashier", "warehouse_admin", "driver"],
  pos: ["owner", "cashier"],
  stok: ["owner", "warehouse_admin"],
  pelanggan: ["owner", "cashier"],
  driver: ["owner", "driver"],
};

export default function TabsLayout() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();

  // session guard: block protected tabs when not authenticated
  if (!loading && !user) {
    return <Redirect href="/login" />;
  }

  const role = (user?.role || "cashier") as Role;

  const canSee = (name: string) => VISIBILITY[name]?.includes(role);
  const href = (name: string) => (canSee(name) ? undefined : null);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Beranda",
          tabBarIcon: ({ color, size }) => <Icon name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pos"
        options={{
          href: href("pos"),
          title: "Kasir",
          tabBarIcon: ({ color, size }) => <Icon name="cart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stok"
        options={{
          href: href("stok"),
          title: "Stok",
          tabBarIcon: ({ color, size }) => <Icon name="cube-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pelanggan"
        options={{
          href: href("pelanggan"),
          title: "Pelanggan",
          tabBarIcon: ({ color, size }) => <Icon name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="driver"
        options={{
          href: href("driver"),
          title: "Driver",
          tabBarIcon: ({ color, size }) => <Icon name="car-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
