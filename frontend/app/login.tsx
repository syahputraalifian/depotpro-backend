import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { useAuth } from "@/src/auth/AuthContext";
import { AppButton, Field, useToast } from "@/src/ui";

const DEMO = [
  { role: "Pemilik", email: "owner@gasgalon.id", pass: "owner12345" },
  { role: "Kasir", email: "kasir@gasgalon.id", pass: "kasir12345" },
  { role: "Gudang", email: "gudang@gasgalon.id", pass: "gudang12345" },
  { role: "Driver", email: "driver@gasgalon.id", pass: "driver12345" },
];

export default function Login() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("owner@gasgalon.id");
  const [password, setPassword] = useState("owner12345");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      toast("Isi email dan password", "error");
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      toast(e.message || "Gagal masuk", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.brand, colors.brandSecondary]} style={[styles.hero, { paddingTop: insets.top + 40 }]}>
        <View style={styles.logoBox}>
          <Icon name="water" size={34} color={colors.onBrandPrimary} />
        </View>
        <Text style={styles.appName}>GasGalon ERP</Text>
        <Text style={styles.tagline}>Manajemen LPG, Air Galon & Depot</Text>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.welcome}>Masuk ke Akun</Text>
          <Text style={styles.sub}>Gunakan akun yang diberikan pemilik usaha</Text>

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="email@usaha.id"
            keyboardType="email-address"
            autoCapitalize="none"
            testID="login-email-input"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            testID="login-password-input"
          />

          <AppButton title="Masuk" onPress={submit} loading={loading} icon="log-in-outline" testID="login-submit-button" />

          <Text style={styles.demoLabel}>Login cepat (demo):</Text>
          <View style={styles.demoRow}>
            {DEMO.map((d) => (
              <Pressable
                key={d.role}
                testID={`demo-${d.role.toLowerCase()}-button`}
                onPress={() => {
                  setEmail(d.email);
                  setPassword(d.pass);
                }}
                style={styles.demoChip}
              >
                <Text style={styles.demoChipText}>{d.role}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  hero: { paddingBottom: 36, paddingHorizontal: 24, alignItems: "center", borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  logoBox: {
    width: 68, height: 68, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center", marginBottom: 14,
  },
  appName: { color: c.onBrandPrimary, fontSize: 26, fontWeight: "800" },
  tagline: { color: c.onBrandPrimary, fontSize: 13, opacity: 0.9, marginTop: 4 },
  form: { padding: 24 },
  welcome: { fontSize: 22, fontWeight: "800", color: c.onSurface, marginBottom: 4 },
  sub: { fontSize: 13, color: c.muted, marginBottom: 24 },
  demoLabel: { marginTop: 24, marginBottom: 10, color: c.muted, fontSize: 12, fontWeight: "600" },
  demoRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  demoChip: { backgroundColor: c.brandTertiary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  demoChipText: { color: c.onBrandTertiary, fontWeight: "700", fontSize: 13 },
}));
