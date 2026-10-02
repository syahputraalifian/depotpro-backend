import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { api } from "@/src/api";

export default function LoginScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState("owner@gasgalon.id");
  const [password, setPassword] = useState("owner12345");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Peringatan", "Email dan Password wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      if (res?.access_token) {
        router.replace("/(tabs)");
      } else {
        Alert.alert("Gagal Login", "Email atau Password salah");
      }
    } catch (e: any) {
      Alert.alert("Gagal Login", e?.message || "Kredensial tidak valid");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Icon name="water" size={36} color="#fff" />
        </View>

        <Text style={styles.title}>DepotPro ERP</Text>
        <Text style={styles.subtitle}>Sistem Kelola Depot Air & Gas LPG</Text>

        <Text style={styles.label}>Email / Username</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          placeholder="email@gasgalon.id"
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={colors.muted}
        />

        <Pressable
          style={[styles.btn, loading && { opacity: 0.6 }]}
          disabled={loading}
          onPress={handleLogin}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>MASUK</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface, justifyContent: "center", padding: 20 },
  card: { backgroundColor: c.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: c.border },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.brandPrimary, justifyContent: "center", alignItems: "center", alignSelf: "center", marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "800", color: c.onSurface, textAlign: "center" },
  subtitle: { fontSize: 13, color: c.muted, textAlign: "center", marginBottom: 24, marginTop: 4 },
  label: { fontSize: 12, fontWeight: "700", color: c.onSurface, marginBottom: 6, marginTop: 10 },
  input: { height: 44, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 12, color: c.onSurface, backgroundColor: c.surfaceSecondary },
  btn: { backgroundColor: c.brandPrimary, paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 24 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
}));