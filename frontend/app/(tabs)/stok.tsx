import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, Modal, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { useAuth } from "@/src/auth/AuthContext";
import { api } from "@/src/api";
import { rupiah, CATEGORY_LABELS } from "@/src/format";
import { AppButton, Badge, Field, EmptyState, useToast } from "@/src/ui";

const SEG = [
  { key: "all", label: "Semua" },
  { key: "lpg", label: "Gas LPG" },
  { key: "galon_brand", label: "Air Galon" },
  { key: "refill", label: "Isi Ulang" },
];

const EMPTY_FORM = {
  name: "", category: "lpg", cost_price: "", freight_cost: "", depreciation_cost: "",
  price_eceran: "", price_warung: "", price_pangkalan: "", price_korporat: "",
  deposit_amount: "", stock_filled: "", stock_empty: "", reorder_point: "10",
};

export default function Stok() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const toast = useToast();
  const canEdit = user?.role === "owner" || user?.role === "warehouse_admin";

  const [products, setProducts] = useState<any[]>([]);
  const [seg, setSeg] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [adjust, setAdjust] = useState<any>(null);
  const [adjFilled, setAdjFilled] = useState("0");
  const [adjEmpty, setAdjEmpty] = useState("0");

  const load = useCallback(async () => {
    try { setProducts(await api.get("/products")); } catch (e: any) { toast(e.message, "error"); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const filtered = seg === "all" ? products : products.filter((p) => p.category === seg);
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  const saveProduct = async () => {
    if (!form.name) { toast("Nama produk wajib diisi", "error"); return; }
    setSaving(true);
    try {
      const num = (v: string) => Number(v || 0);
      await api.post("/products", {
        name: form.name, category: form.category, is_returnable: form.category !== "refill" ? true : true,
        cost_price: num(form.cost_price), freight_cost: num(form.freight_cost), depreciation_cost: num(form.depreciation_cost),
        price_eceran: num(form.price_eceran), price_warung: num(form.price_warung),
        price_pangkalan: num(form.price_pangkalan), price_korporat: num(form.price_korporat),
        deposit_amount: num(form.deposit_amount), stock_filled: num(form.stock_filled),
        stock_empty: num(form.stock_empty), reorder_point: num(form.reorder_point),
      });
      toast("Produk ditambahkan", "success");
      setAddModal(false); setForm(EMPTY_FORM); load();
    } catch (e: any) { toast(e.message, "error"); } finally { setSaving(false); }
  };

  const saveAdjust = async () => {
    try {
      await api.post(`/products/${adjust.id}/adjust`, {
        stock_filled_delta: Number(adjFilled || 0), stock_empty_delta: Number(adjEmpty || 0),
      });
      toast("Stok diperbarui", "success");
      setAdjust(null); setAdjFilled("0"); setAdjEmpty("0"); load();
    } catch (e: any) { toast(e.message, "error"); }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Stok & Aset</Text>
        {canEdit && (
          <Pressable testID="add-product-button" onPress={() => setAddModal(true)} style={styles.addBtn}>
            <Icon name="add" size={22} color={colors.onBrandPrimary} />
          </Pressable>
        )}
      </View>

      <View style={styles.segWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segContent}>
          {SEG.map((s) => {
            const active = seg === s.key;
            return (
              <Pressable key={s.key} testID={`seg-${s.key}`} onPress={() => setSeg(s.key)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}>
        {filtered.map((p) => {
          const low = p.stock_filled <= p.reorder_point;
          return (
            <View key={p.id} style={styles.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.name}</Text>
                  <Text style={styles.hpp}>HPP {rupiah(p.hpp)} • Jual {rupiah(p.price_eceran)}</Text>
                </View>
                <Badge text={CATEGORY_LABELS[p.category]} bg={colors.brandTertiary} fg={colors.onBrandTertiary} />
              </View>
              <View style={styles.statRow}>
                <Stat label="Isi Gudang" value={p.stock_filled} color={low ? colors.error : colors.brandPrimary} />
                <Stat label="Kosong" value={p.stock_empty} color={colors.assetGallon} />
                <Stat label="Reorder" value={p.reorder_point} color={colors.muted} />
              </View>
              {low && <View style={styles.lowBanner}><Icon name="alert-circle" size={14} color={colors.onError} /><Text style={styles.lowText}>Stok di bawah minimum!</Text></View>}
              {canEdit && (
                <Pressable testID={`adjust-${p.id}`} onPress={() => setAdjust(p)} style={styles.adjustBtn}>
                  <Icon name="create-outline" size={16} color={colors.brandPrimary} />
                  <Text style={styles.adjustText}>Sesuaikan Stok</Text>
                </Pressable>
              )}
            </View>
          );
        })}
        {filtered.length === 0 && <EmptyState icon="cube-outline" title="Belum ada produk" subtitle="Tambah produk/aset baru" />}
      </ScrollView>

      {/* Add product modal */}
      <Modal visible={addModal} animationType="slide" transparent onRequestClose={() => setAddModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAddModal(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, maxHeight: "88%" }]}>
          <Text style={styles.sheetTitle}>Tambah Produk</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Field label="Nama Produk" value={form.name} onChangeText={(v: string) => set("name", v)} placeholder="LPG 3 Kg" testID="pf-name" />
            <Text style={styles.fieldLabel}>Kategori</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
              {["lpg", "galon_brand", "refill"].map((k) => (
                <Pressable key={k} testID={`pf-cat-${k}`} onPress={() => set("category", k)} style={[styles.catBtn, form.category === k && styles.catBtnActive]}>
                  <Text style={[styles.catBtnText, form.category === k && styles.catBtnTextActive]}>{CATEGORY_LABELS[k]}</Text>
                </Pressable>
              ))}
            </View>
            <Field label="Harga Beli / Isi (HPP dasar)" value={form.cost_price} onChangeText={(v: string) => set("cost_price", v)} keyboardType="numeric" placeholder="16000" testID="pf-cost" />
            <Field label="Biaya Armada / Ongkir per unit" value={form.freight_cost} onChangeText={(v: string) => set("freight_cost", v)} keyboardType="numeric" placeholder="1000" />
            <Field label="Penyusutan Aset per unit" value={form.depreciation_cost} onChangeText={(v: string) => set("depreciation_cost", v)} keyboardType="numeric" placeholder="500" />
            <Field label="Harga Eceran" value={form.price_eceran} onChangeText={(v: string) => set("price_eceran", v)} keyboardType="numeric" placeholder="22000" testID="pf-price-eceran" />
            <Field label="Harga Warung" value={form.price_warung} onChangeText={(v: string) => set("price_warung", v)} keyboardType="numeric" placeholder="20000" />
            <Field label="Harga Pangkalan" value={form.price_pangkalan} onChangeText={(v: string) => set("price_pangkalan", v)} keyboardType="numeric" placeholder="18500" />
            <Field label="Harga Korporat" value={form.price_korporat} onChangeText={(v: string) => set("price_korporat", v)} keyboardType="numeric" placeholder="18000" />
            <Field label="Deposit Wadah" value={form.deposit_amount} onChangeText={(v: string) => set("deposit_amount", v)} keyboardType="numeric" placeholder="150000" />
            <Field label="Stok Isi Awal" value={form.stock_filled} onChangeText={(v: string) => set("stock_filled", v)} keyboardType="numeric" placeholder="100" />
            <Field label="Stok Kosong Awal" value={form.stock_empty} onChangeText={(v: string) => set("stock_empty", v)} keyboardType="numeric" placeholder="40" />
            <Field label="Reorder Point" value={form.reorder_point} onChangeText={(v: string) => set("reorder_point", v)} keyboardType="numeric" placeholder="10" />
            <AppButton title="Simpan Produk" onPress={saveProduct} loading={saving} icon="save-outline" testID="save-product-button" />
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Adjust modal */}
      <Modal visible={!!adjust} animationType="slide" transparent onRequestClose={() => setAdjust(null)}>
        <Pressable style={styles.backdrop} onPress={() => setAdjust(null)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.sheetTitle}>Sesuaikan Stok</Text>
          <Text style={styles.sheetSub}>{adjust?.name}</Text>
          <Field label="Tambah/Kurang Stok Isi (+/-)" value={adjFilled} onChangeText={setAdjFilled} keyboardType="numbers-and-punctuation" testID="adj-filled" />
          <Field label="Tambah/Kurang Stok Kosong (+/-)" value={adjEmpty} onChangeText={setAdjEmpty} keyboardType="numbers-and-punctuation" testID="adj-empty" />
          <AppButton title="Perbarui" onPress={saveAdjust} icon="checkmark" testID="save-adjust-button" />
        </View>
      </Modal>
    </View>
  );
}

function Stat({ label, value, color }: any) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, backgroundColor: c.brand, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
  title: { color: c.onBrandPrimary, fontSize: 20, fontWeight: "800" },
  addBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  segWrap: { height: 56, justifyContent: "center", backgroundColor: c.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: c.border },
  segContent: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  chip: { height: 36, paddingHorizontal: 16, borderRadius: 999, backgroundColor: c.surfaceTertiary, justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: c.brandPrimary },
  chipText: { color: c.onSurfaceTertiary, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: c.onBrandPrimary },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: c.border },
  name: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  hpp: { fontSize: 12, color: c.muted, marginTop: 2 },
  statRow: { flexDirection: "row", marginTop: 14, gap: 8 },
  stat: { flex: 1, alignItems: "center", backgroundColor: c.surfaceTertiary, borderRadius: 10, paddingVertical: 10 },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 10, color: c.muted, marginTop: 2 },
  lowBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.error, borderRadius: 8, padding: 8, marginTop: 10 },
  lowText: { color: c.onError, fontSize: 12, fontWeight: "600" },
  adjustBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: c.brandTertiary },
  adjustText: { color: c.brandPrimary, fontWeight: "700", fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: c.onSurface, marginBottom: 4 },
  sheetSub: { fontSize: 13, color: c.muted, marginBottom: 14 },
  fieldLabel: { color: c.onSurfaceSecondary, fontSize: 13, fontWeight: "600", marginBottom: 6 },
  catBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: c.surfaceTertiary, alignItems: "center" },
  catBtnActive: { backgroundColor: c.brandPrimary },
  catBtnText: { fontSize: 11, fontWeight: "600", color: c.onSurfaceTertiary },
  catBtnTextActive: { color: c.onBrandPrimary },
}));
