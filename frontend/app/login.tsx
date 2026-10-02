import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { api, TOKEN_KEY } from "@/src/api";
import { storage } from "@/src/utils/storage";
import * as uiModule from "@/src/ui";

const ROLE_PRESETS = [
  {
    role: "owner",
    label: "Pemilik Depot (Owner)",
    email: "owner@gasgalon.id",
    pass: "owner12345",
    icon: "briefcase-outline",
    color: "#2563eb",
  },
  {
    role: "kasir",
    label: "Kasir Depot",
    email: "kasir@gasgalon.id",
    pass: "kasir12345",
    icon: "cart-outline",
    color: "#16a34a",
  },
  {
    role: "gudang",
    label: "Staf Gudang",
    email: "gudang@gasgalon.id",
    pass: "gudang12345",
    icon: "cube-outline",
    color: "#d97706",
  },
  {
    role: "driver",
    label: "Driver Kurir",
    email: "driver@gasgalon.id",
    pass: "driver12345",
    icon: "car-outline",
    color: "#0891b2",
  },
];

export default function LoginScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const showToast = (msg: string) => {
    try {
      const useToastHook = (uiModule as any)?.useToast;
      if (typeof useToastHook === "function") {
        const toast = useToastHook();
        if (typeof toast === "function") toast(msg);
        else if (toast?.show) toast.show(msg);
      }
    } catch (e) {}
  };

  const handleSelectPreset = (preset: typeof ROLE_PRESETS[0]) => {
    setSelectedRole(preset.role);
    setEmail(preset.email);
    setPassword(preset.pass);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showToast("Email dan Password wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const loginApi = typeof api?.login === "function" ? api.login : null;
      if (loginApi) {
        const res = await loginApi({ email: email.trim(), password: password.trim() });
        if (res && res.access_token) {
          await storage.secureSet(TOKEN_KEY, res.access_token);
          showToast(`Selamat datang, ${res.user?.name || "Pengguna"}`);
          router.replace("/(tabs)");
          return;
        }
      }
      showToast("Gagal melakukan autentikasi");
    } catch (e: any) {
      showToast(e?.message || e?.detail || "Email atau password salah");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={[styles.root, { paddingTop: insets.top }]}
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
      >
        <View style={styles.headerBox}>
          <View style={styles.logoBadge}>
            <Icon name="water-outline" size={36} color="#fff" />
          </View>
          <Text style={styles.appTitle}>DepotPro ERP</Text>
          <Text style={styles.appSubtitle}>Manajemen Depot Gas Galon</Text>
        </View>

        {/* Pilihan Cepat Role (Owner, Kasir, Gudang, Driver) */}
        <Text style={styles.sectionTitle}>Pilih Role Akun Demo:</Text>
        <View style={styles.presetGrid}>
          {ROLE_PRESETS.map((item) => {
            const active = selectedRole === item.role || email === item.email;
            return (
              <Pressable
                key={item.role}
                onPress={() => handleSelectPreset(item)}
                style={[
                  styles.presetCard,
                  active && { borderColor: item.color, backgroundColor: `${item.color}10` },
                ]}
              >
                <Icon name={item.icon as any} size={20} color={active ? item.color : colors.muted} />
                <Text
                  style={[
                    styles.presetLabel,
                    active && { color: item.color, fontWeight: "800" },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Form Input Manual */}
        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>Email / Username</Text>
          <View style={styles.inputBox}>
            <Icon name="mail-outline" size={18} color={colors.muted} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setSelectedRole(null);
              }}
              placeholder="Masukkan email..."
              autoCapitalize="none"
              placeholderTextColor={colors.muted}
            />
          </View>

          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.inputBox}>
            <Icon name="lock-closed-outline" size={18} color={colors.muted} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setSelectedRole(null);
              }}
              placeholder="Masukkan password..."
              secureTextEntry
              placeholderTextColor={colors.muted}
            />
          </View>

          <Pressable
            style={[styles.loginBtn, loading && { opacity: 0.6 }]}
            disabled={loading}
            onPress={handleLogin}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loginBtnText}>Masuk Aplikasi</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  headerBox: { alignItems: "center", marginVertical: 24 },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: c.brandPrimary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  appTitle: { fontSize: 22, fontWeight: "800", color: c.onSurface },
  appSubtitle: { fontSize: 13, color: c.muted, marginTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: c.onSurface, marginBottom: 10 },
  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  presetCard: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceSecondary,
  },
  presetLabel: { fontSize: 12, color: c.onSurface, fontWeight: "600" },
  formContainer: { gap: 12 },
  inputLabel: { fontSize: 12, fontWeight: "700", color: c.onSurface },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: c.surfaceSecondary,
  },
  input: { flex: 1, marginLeft: 8, fontSize: 13, color: c.onSurface },
  loginBtn: {
    backgroundColor: c.brandPrimary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  loginBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
}));