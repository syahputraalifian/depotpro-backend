import React, { useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Switch,
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import * as authModule from "@/src/auth/AuthContext";
import * as apiModule from "@/src/api";
import * as uiModule from "@/src/ui";

const { AppButton, Field } = uiModule;

export default function PengaturanScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const useAuthHook = (authModule as any)?.useAuth;
  const authContext = typeof useAuthHook === "function" ? useAuthHook() : null;
  const user = authContext?.user;
  const logout = authContext?.logout;

  const showToast = useCallback((msg: string, type?: string) => {
    try {
      const useToastHook = (uiModule as any)?.useToast;
      if (typeof useToastHook === "function") {
        const toast = useToastHook();
        if (typeof toast === "function") {
          toast(msg, type);
          return;
        } else if (toast?.show) {
          toast.show(msg, type);
          return;
        }
      }
    } catch {
      console.log(`[Toast ${type || "info"}]:`, msg);
    }
  }, []);

  const getApi = (apiModule as any)?.api || (apiModule as any)?.default;

  // Form State Pengaturan Depot
  const [depotForm, setDepotForm] = useState({
    name: "Depot Air & Gas Pro",
    phone: "08123456789",
    address: "Jl. Utama Depot No. 12",
    receipt_footer: "Terima kasih atas kunjungan Anda!",
  });

  const [printerPaper80, setPrinterPaper80] = useState(false);
  const [autoPrint, setAutoPrint] = useState(true);
  const [depotModal, setDepotModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Ambil Data Profil Depot dari Backend
  const loadDepotProfile = useCallback(async () => {
    try {
      if (getApi && typeof getApi.get === "function") {
        const res = await getApi.get("/settings/depot").catch(() => null);
        if (res) {
          setDepotForm({
            name: res?.name || depotForm.name,
            phone: res?.phone || depotForm.phone,
            address: res?.address || depotForm.address,
            receipt_footer: res?.receipt_footer || depotForm.receipt_footer,
          });
        }
      }
    } catch {
      // Fallback silent
    }
  }, [getApi]);

  useFocusEffect(
    useCallback(() => {
      loadDepotProfile();
    }, [loadDepotProfile])
  );

  const saveDepotProfile = async () => {
    setSaving(true);
    try {
      if (getApi && typeof getApi.put === "function") {
        await getApi.put("/settings/depot", depotForm);
      }
      showToast("Profil depot berhasil diperbarui", "success");
      setDepotModal(false);
    } catch (e: any) {
      showToast(e?.message || "Gagal menyimpan profil depot", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Konfirmasi Logout", "Apakah Anda yakin ingin keluar?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Keluar",
        style: "destructive",
        onPress: async () => {
          if (typeof logout === "function") {
            await logout();
          }
          router.replace("/login" as any);
        },
      },
    ]);
  };

  const getRoleLabel = (role?: string) => {
    if (role === "owner") return "Pemilik (Owner)";
    if (role === "warehouse_admin") return "Admin Gudang";
    if (role === "cashier") return "Kasir";
    if (role === "courier") return "Kurir Delivery";
    return role || "Staf";
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Pengaturan & Profil</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Card Profil Akun Login */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Icon name="person" size={28} color={colors.brandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.name || "Pengguna Depot"}</Text>
            <Text style={styles.userPhone}>{user?.phone || "08xxxxxxxxxx"}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{getRoleLabel(user?.role)}</Text>
            </View>
          </View>
        </View>

        {/* Section Pengaturan Depot */}
        <Text style={styles.sectionTitle}>Profil Depot & Toko</Text>
        <View style={styles.card}>
          <Pressable
            style={styles.menuRow}
            onPress={() => setDepotModal(true)}
          >
            <Icon name="storefront-outline" size={20} color={colors.brandPrimary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.menuTitle}>Informasi Depot</Text>
              <Text style={styles.menuSub}>{depotForm.name}</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        </View>

        {/* Section Pengaturan Struk & Printer */}
        <Text style={styles.sectionTitle}>Printer Struk Bluetooth</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>Cetak Struk Otomatis</Text>
              <Text style={styles.menuSub}>Langsung cetak setelah transaksi</Text>
            </View>
            <Switch
              value={autoPrint}
              onValueChange={setAutoPrint}
              trackColor={{ false: colors.border, true: colors.brandPrimary }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>Ukuran Kertas 80mm</Text>
              <Text style={styles.menuSub}>
                {printerPaper80 ? "Ukuran 80mm (Besar)" : "Ukuran 58mm (Kecil/Standar)"}
              </Text>
            </View>
            <Switch
              value={printerPaper80}
              onValueChange={setPrinterPaper80}
              trackColor={{ false: colors.border, true: colors.brandPrimary }}
            />
          </View>
        </View>

        {/* Tombol Logout */}
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Icon name="log-out-outline" size={20} color={colors.onError} />
          <Text style={styles.logoutText}>Keluar dari Akun</Text>
        </Pressable>
      </ScrollView>

      {/* Modal Edit Informasi Depot */}
      <Modal
        visible={depotModal}
        animationType="slide"
        transparent
        onRequestClose={() => setDepotModal(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setDepotModal(false)}
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.sheetTitle}>Edit Informasi Depot</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Field
              label="Nama Depot"
              value={depotForm.name}
              onChangeText={(v: string) => setDepotForm((f) => ({ ...f, name: v }))}
              placeholder="Depot Sejahtera"
            />
            <Field
              label="Nomor Telepon / WA Depot"
              value={depotForm.phone}
              onChangeText={(v: string) => setDepotForm((f) => ({ ...f, phone: v }))}
              keyboardType="phone-pad"
              placeholder="08123456789"
            />
            <Field
              label="Alamat Lengkap"
              value={depotForm.address}
              onChangeText={(v: string) => setDepotForm((f) => ({ ...f, address: v }))}
              placeholder="Jl. Merdeka No. 10..."
            />
            <Field
              label="Pesan Kaki Struk (Receipt Footer)"
              value={depotForm.receipt_footer}
              onChangeText={(v: string) => setDepotForm((f) => ({ ...f, receipt_footer: v }))}
              placeholder="Terima kasih..."
            />

            <AppButton
              title="Simpan Informasi Depot"
              onPress={saveDepotProfile}
              loading={saving}
              icon="save-outline"
              style={{ marginTop: 8 }}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: c.brand,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  title: { color: c.onBrandPrimary, fontSize: 20, fontWeight: "800" },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surfaceSecondary,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: 16,
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: c.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  userPhone: { fontSize: 12, color: c.muted, marginTop: 2 },
  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: c.brandTertiary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
  },
  roleText: { fontSize: 10, fontWeight: "700", color: c.brandPrimary },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: c.muted,
    marginBottom: 8,
    marginTop: 8,
  },
  card: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: 12,
  },
  menuRow: { flexDirection: "row", alignItems: "center" },
  menuTitle: { fontSize: 14, fontWeight: "700", color: c.onSurface },
  menuSub: { fontSize: 12, color: c.muted, marginTop: 2 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  divider: { height: 1, backgroundColor: c.border, marginVertical: 12 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: c.error,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 16,
  },
  logoutText: { color: c.error, fontWeight: "800", fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: c.onSurface,
    marginBottom: 14,
  },
}));