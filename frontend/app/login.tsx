import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState("owner@gasgalon.id");
  const [password, setPassword] = useState("owner12345");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Email dan Password wajib diisi!");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      if (res?.access_token) {
        router.replace("/(tabs)");
      } else {
        Alert.alert("Gagal Login", "Email atau Password Salah");
      }
    } catch (e: any) {
      Alert.alert("Gagal Login", e?.message || "Email atau password tidak valid");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#fff", paddingTop: insets.top }}>
      <Text style={{ fontSize: 26, fontWeight: "800", color: "#0284c7", marginBottom: 6, textAlign: "center" }}>
        DepotPro ERP
      </Text>
      <Text style={{ fontSize: 14, color: "#64748b", marginBottom: 30, textAlign: "center" }}>
        Masuk ke Sistem Manajemen Gas & Galon
      </Text>

      <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 6 }}>Email / Username</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, padding: 12, marginBottom: 16 }}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />

      <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 6 }}>Password</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, padding: 12, marginBottom: 24 }}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Pressable
        style={{ backgroundColor: "#0284c7", paddingVertical: 14, borderRadius: 10, alignItems: "center" }}
        disabled={loading}
        onPress={handleLogin}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>MASUK SEKARANG</Text>}
      </Pressable>
    </View>
  );
}