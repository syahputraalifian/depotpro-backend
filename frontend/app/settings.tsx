import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { api } from "@/src/api";
import { AppButton, useToast } from "@/src/ui";

const OPTIONS = [
  { key: "print", label: "Cetak Struk (Default)", desc: "Langsung buka dialog cetak setelah bayar", icon: "print-outline" },
  { key: "whatsapp", label: "Kirim WhatsApp", desc: "Otomatis siapkan struk via WhatsApp", icon: "logo-whatsapp" },
  { key: "skip", label: "Tanpa Struk", desc: "Transaksi cepat, tampilkan pilihan struk manual", icon: "flash-outline" },
];

export default function Settings() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [sel, setSel] = useState("whatsapp");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { const s = await api.get("/settings"); setSel(s.default_receipt_option || "whatsapp"); } catch (e: any) { toast(e.message, "error"); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    setSaving(true);
    try { await api.put("/settings", { default_receipt_option: sel }); toast("Pengaturan disimpan", "success"); }
    catch (e: any) { toast(e.message, "error"); } finally { setSaving(false); }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable testID="back-button" onPress={() => router.back()} style={styles.iconBtn}><Icon name="arrow-back" size={22} color={colors.onBrandPrimary} /></Pressable>
        <Text style={styles.title}>Pengaturan</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.section}>Opsi Struk Bawaan Kasir</Text>
        <Text style={styles.sectionSub}>Pilih aksi otomatis setelah transaksi selesai di kasir.</Text>
        {OPTIONS.map((o) => {
          const active = sel === o.key;
          return (
            <Pressable key={o.key} testID={`opt-${o.key}`} onPress={() => setSel(o.key)} style={[styles.optCard, active && styles.optCardActive]}>
              <View style={[styles.optIcon, active && { backgroundColor: colors.brandPrimary }]}>
                <Icon name={o.icon as any} size={20} color={active ? colors.onBrandPrimary : colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optLabel}>{o.label}</Text>
                <Text style={styles.optDesc}>{o.desc}</Text>
              </View>
              <Icon name={active ? "radio-button-on" : "radio-button-off"} size={22} color={active ? colors.brandPrimary : colors.muted} />
            </Pressable>
          );
        })}
        <View style={styles.note}>
          <Icon name="information-circle-outline" size={18} color={colors.info} />
          <Text style={styles.noteText}>Cetak thermal Bluetooth khusus membutuhkan build aplikasi (APK/IPA). Di Expo Go, cetak memakai dialog cetak sistem.</Text>
        </View>
        <AppButton title="Simpan Pengaturan" onPress={save} loading={saving} icon="save-outline" testID="save-settings-button" style={{ marginTop: 20 }} />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, backgroundColor: c.brand, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  title: { color: c.onBrandPrimary, fontSize: 18, fontWeight: "800" },
  section: { fontSize: 16, fontWeight: "800", color: c.onSurface, marginBottom: 4 },
  sectionSub: { fontSize: 13, color: c.muted, marginBottom: 16 },
  optCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: c.surfaceSecondary, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: c.border },
  optCardActive: { borderColor: c.brandPrimary },
  optIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  optLabel: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  optDesc: { fontSize: 12, color: c.muted, marginTop: 2 },
  note: { flexDirection: "row", gap: 10, backgroundColor: c.surfaceTertiary, borderRadius: 12, padding: 14, marginTop: 8 },
  noteText: { flex: 1, fontSize: 12, color: c.onSurfaceSecondary, lineHeight: 18 },
}));
