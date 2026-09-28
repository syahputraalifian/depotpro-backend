import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, Modal, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { api } from "@/src/api";
import { ROLE_LABELS, rupiah } from "@/src/format";
import { AppButton, Badge, Field, EmptyState, useToast } from "@/src/ui";

const ROLES = ["driver", "cashier", "warehouse_admin", "owner"];
const EMPTY = { email: "", password: "", name: "", role: "driver", phone: "", vehicle_type: "", plate_number: "", base_salary: "", incentive_rate: "" };

export default function ManageUsers() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();

  const [users, setUsers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setUsers(await api.get("/users")); } catch (e: any) { toast(e.message, "error"); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));
  const active = users.filter((u) => !u.disabled);

  const openAdd = () => { setEditId(null); setForm(EMPTY); setModal(true); };
  const openEdit = (u: any) => {
    setEditId(u.id);
    setForm({ email: u.email, password: "", name: u.name, role: u.role, phone: u.phone || "", vehicle_type: u.vehicle_type || "", plate_number: u.plate_number || "", base_salary: String(u.base_salary || ""), incentive_rate: String(u.incentive_rate || "") });
    setModal(true);
  };

  const save = async () => {
    if (!form.name) { toast("Nama wajib diisi", "error"); return; }
    if (!editId && (!form.email || form.password.length < 5)) { toast("Email & password (min 5) wajib", "error"); return; }
    setSaving(true);
    try {
      const body: any = {
        name: form.name, role: form.role, phone: form.phone, vehicle_type: form.vehicle_type,
        plate_number: form.plate_number, base_salary: Number(form.base_salary || 0), incentive_rate: Number(form.incentive_rate || 0),
      };
      if (editId) {
        if (form.password) body.password = form.password;
        await api.put(`/users/${editId}`, body);
      } else {
        await api.post("/users", { ...body, email: form.email, password: form.password });
      }
      toast(editId ? "Data diperbarui" : "Karyawan ditambahkan", "success");
      setModal(false); setForm(EMPTY); setEditId(null); load();
    } catch (e: any) { toast(e.message, "error"); } finally { setSaving(false); }
  };

  const remove = async (u: any) => {
    try {
      await api.del(`/users/${u.id}`);
      toast("Karyawan dinonaktifkan", "success");
      load();
    } catch (e: any) { toast(e.message, "error"); }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable testID="back-button" onPress={() => router.back()} style={styles.iconBtn}><Icon name="arrow-back" size={22} color={colors.onBrandPrimary} /></Pressable>
        <Text style={styles.title}>Kelola Kurir & Karyawan</Text>
        <Pressable testID="add-user-button" onPress={openAdd} style={styles.iconBtn}><Icon name="add" size={22} color={colors.onBrandPrimary} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}>
        {active.map((u) => (
          <View key={u.id} style={styles.card}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={styles.avatar}><Icon name={u.role === "driver" ? "car" : u.role === "cashier" ? "cart" : u.role === "warehouse_admin" ? "cube" : "star"} size={20} color={colors.brandPrimary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{u.name}</Text>
                <Text style={styles.sub}>{u.email}</Text>
              </View>
              <Badge text={ROLE_LABELS[u.role]} bg={colors.brandTertiary} fg={colors.onBrandTertiary} />
            </View>
            {u.role === "driver" && (u.vehicle_type || u.plate_number || u.phone) && (
              <Text style={styles.vehicle}>{[u.vehicle_type, u.plate_number, u.phone].filter(Boolean).join(" • ")}</Text>
            )}
            {(u.base_salary > 0 || u.incentive_rate > 0) && (
              <Text style={styles.salary}>Gaji pokok {rupiah(u.base_salary)}{u.incentive_rate > 0 ? ` • Insentif ${rupiah(u.incentive_rate)}/unit` : ""}</Text>
            )}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Pressable testID={`edit-user-${u.id}`} onPress={() => openEdit(u)} style={styles.actionBtn}><Icon name="create-outline" size={16} color={colors.brandPrimary} /><Text style={styles.actionText}>Edit</Text></Pressable>
              <Pressable testID={`delete-user-${u.id}`} onPress={() => remove(u)} style={[styles.actionBtn, { backgroundColor: colors.receivableBadge }]}><Icon name="trash-outline" size={16} color={colors.error} /><Text style={[styles.actionText, { color: colors.error }]}>Nonaktifkan</Text></Pressable>
            </View>
          </View>
        ))}
        {active.length === 0 && <EmptyState icon="people-outline" title="Belum ada karyawan" />}
      </ScrollView>

      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setModal(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, maxHeight: "90%" }]}>
          <Text style={styles.sheetTitle}>{editId ? "Edit Karyawan" : "Tambah Kurir / Karyawan"}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Field label="Nama" value={form.name} onChangeText={(v: string) => set("name", v)} placeholder="Budi Kurir" testID="uf-name" />
            {!editId && <Field label="Email" value={form.email} onChangeText={(v: string) => set("email", v)} keyboardType="email-address" autoCapitalize="none" placeholder="kurir@gasgalon.id" testID="uf-email" />}
            <Field label={editId ? "Password Baru (kosongkan jika tetap)" : "Password"} value={form.password} onChangeText={(v: string) => set("password", v)} secureTextEntry placeholder="min 5 karakter" testID="uf-password" />
            <Text style={styles.fieldLabel}>Peran</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {ROLES.map((r) => (
                <Pressable key={r} testID={`uf-role-${r}`} onPress={() => set("role", r)} style={[styles.roleBtn, form.role === r && styles.roleBtnActive]}>
                  <Text style={[styles.roleText, form.role === r && styles.roleTextActive]}>{ROLE_LABELS[r]}</Text>
                </Pressable>
              ))}
            </View>
            <Field label="No. HP" value={form.phone} onChangeText={(v: string) => set("phone", v)} keyboardType="phone-pad" placeholder="08123456789" />
            {form.role === "driver" && (
              <>
                <Field label="Jenis Kendaraan" value={form.vehicle_type} onChangeText={(v: string) => set("vehicle_type", v)} placeholder="Motor / Pickup / Truk" testID="uf-vehicle" />
                <Field label="Plat Nomor" value={form.plate_number} onChangeText={(v: string) => set("plate_number", v)} placeholder="B 1234 XYZ" testID="uf-plate" />
              </>
            )}
            <Field label="Gaji Pokok" value={form.base_salary} onChangeText={(v: string) => set("base_salary", v)} keyboardType="numeric" placeholder="1500000" />
            <Field label="Tarif Insentif per Unit Antar" value={form.incentive_rate} onChangeText={(v: string) => set("incentive_rate", v)} keyboardType="numeric" placeholder="2000" />
            <AppButton title={editId ? "Simpan Perubahan" : "Tambah Karyawan"} onPress={save} loading={saving} icon="save-outline" testID="save-user-button" />
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, backgroundColor: c.brand, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  title: { color: c.onBrandPrimary, fontSize: 17, fontWeight: "800", flex: 1, textAlign: "center" },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: c.border },
  avatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  sub: { fontSize: 12, color: c.muted, marginTop: 2 },
  vehicle: { fontSize: 12, color: c.onSurfaceSecondary, marginTop: 10 },
  salary: { fontSize: 12, color: c.muted, marginTop: 4 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: c.brandTertiary },
  actionText: { color: c.brandPrimary, fontWeight: "700", fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: c.onSurface, marginBottom: 14 },
  fieldLabel: { color: c.onSurfaceSecondary, fontSize: 13, fontWeight: "600", marginBottom: 6 },
  roleBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: c.surfaceTertiary },
  roleBtnActive: { backgroundColor: c.brandPrimary },
  roleText: { fontSize: 12, fontWeight: "600", color: c.onSurfaceTertiary },
  roleTextActive: { color: c.onBrandPrimary },
}));
