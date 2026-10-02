import React from "react";
import { Tabs } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import { useTheme } from "@/src/theme";

export default function TabLayout() {
  const { colors } = useTheme();

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
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <Icon name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pos"
        options={{
          title: "Kasir",
          tabBarIcon: ({ color, size }) => <Icon name="cart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stok"
        options={{
          title: "Stok",
          tabBarIcon: ({ color, size }) => <Icon name="cube-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pelanggan"
        options={{
          title: "Pelanggan",
          tabBarIcon: ({ color, size }) => <Icon name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="driver"
        options={{
          title: "Driver",
          tabBarIcon: ({ color, size }) => <Icon name="bicycle-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="laporan"
        options={{
          title: "Laporan",
          tabBarIcon: ({ color, size }) => <Icon name="document-text-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="setoran"
        options={{
          title: "Setoran",
          tabBarIcon: ({ color, size }) => <Icon name="wallet-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}