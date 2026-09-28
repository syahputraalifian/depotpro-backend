import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, Modal, RefreshControl, TextInput } from "react-native";
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

function DeltaStepper({ label, current, value, onChange, testID, colors }: any) {
  const delta = Number(value || 0);
  const preview = Number(current || 0) + delta;
  const bump = (d: number) => onChange(String(delta + d));
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.onSurfaceSecondary }}>{label}</Text>
        <Text style={{ fontSize: 12, color: colors.muted }}>
          Saat ini {current} → <Text style={{ fontWeight: "800", color: colors.brandPrimary }}>{preview}</Text>
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable
          testID={`${testID}-minus`}
          onPress={() => bump(-1)}
          style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="remove" size={22} color={colors.onSurface} />
        </Pressable>
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChange}
          keyboardType="numbers-and-punctuation"
          style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border, textAlign: "center", fontSize: 16, fontWeight: "700", color: colors.onSurface, backgroundColor: colors.surfaceSecondary }}
        />
        <Pressable
          testID={`${testID}-plus`}
          onPress={() => bump(1)}
          style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="add" size={22} color={colors.onBrandPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

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
  const [pos, setPos] = useState<any[]>([]);
  const [seg, setSeg] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [showPO, setShowPO] = useState(false);
  const [prodModal, setProdModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [adjust, setAdjust] = useState<any>(null);
  const [adjFilled, setAdjFilled] = useState("0");
  const [adjSold, setAdjSold] = useState("0");
  const [adjEmpty, setAdjEmpty] = useState("0");

  const load = useCallback(async () => {
    try {
      const p = await api.get("/products");
      setProducts(p);
      if (user?.role === "owner" || user?.role === "warehouse_admin") setPos(await api.get("/purchase-orders"));
    } catch (e: any) { toast(e.message, "error"); }
  }, [user?.role]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const filtered = seg === "all" ? products : products.filter((p) => p.category === seg);
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));
  const num = (v: string) => Number(v || 0);
  const draftPOs = pos.filter((p) => p.status === "draft");

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setProdModal(true); };
  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      name: p.name, category: p.category, cost_price: String(p.cost_price), freight_cost: String(p.freight_cost),
      depreciation_cost: String(p.depreciation_cost), price_eceran: String(p.price_eceran), price_warung: String(p.price_warung),
      price_pangkalan: String(p.price_pangkalan), price_korporat: String(p.price_korporat), deposit_amount: String(p.deposit_amount),
      stock_filled: String(p.stock_filled), stock_empty: String(p.stock_empty), reorder_point: String(p.reorder_point),
    });
    setProdModal(true);
  };

  const saveProduct = async () => {
    if (!form.name) { toast("Nama produk wajib diisi", "error"); return; }
    setSaving(true);
    try {
      const body = {
        name: form.name, category: form.category, is_returnable: true,
        cost_price: num(form.cost_price), freight_cost: num(form.freight_cost), depreciation_cost: num(form.depreciation_cost),
        price_eceran: num(form.price_eceran), price_warung: num(form.price_warung),
        price_pangkalan: num(form.price_pangkalan), price_korporat: num(form.price_korporat),
        deposit_amount: num(form.deposit_amount), stock_filled: num(form.stock_filled),
        stock_empty: num(form.stock_empty), reorder_point: num(form.reorder_point),
      };
      if (editId) await api.put(`/products/${editId}`, body);
      else await api.post("/products", body);
      toast(editId ? "Harga & produk diperbarui" : "Produk ditambahkan", "success");
      setProdModal(false); setForm(EMPTY_FORM); setEditId(null); load();
    } catch (e: any) { toast(e.message, "error"); } finally { setSaving(false); }
  };

  const saveAdjust = async () => {
    try {
      await api.post(`/products/${adjust.id}/adjust`, {
        stock_filled_delta: Number(adjFilled || 0),
        total_sold_delta: Number(adjSold || 0),
        stock_empty_delta: Number(adjEmpty || 0),
      });
      toast("Stok diperbarui", "success");
      setAdjust(null); setAdjFilled("0"); setAdjSold("0"); setAdjEmpty("0"); load();
    } catch (e: any) { toast(e.message, "error"); }
  };

  const makePO = async (p: any) => {
    try { await api.post("/purchase-orders", { product_id: p.id, qty: 0 }); toast("Draft PO dibuat", "success"); load(); }
    catch (e: any) { toast(e.message, "error"); }
  };
  const receivePO = async (po: any) => {
    try { await api.post(`/purchase-orders/${po.id}/receive`); toast("Stok masuk diterima", "success"); load(); }
    catch (e: any) { toast(e.message, "error"); }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Katalog & Stok</Text>
        {canEdit && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable testID="show-po-button" onPress={() => setShowPO(true)} style={styles.addBtn}>
              <Icon name="reader-outline" size={20} color={colors.onBrandPrimary} />
              {draftPOs.length > 0 && <View style={styles.poBadge}><Text style={styles.poBadgeText}>{draftPOs.length}</Text></View>}
            </Pressable>
            <Pressable testID="add-product-button" onPress={openAdd} style={styles.addBtn}>
              <Icon name="add" size={22} color={colors.onBrandPrimary} />
            </Pressable>
          </View>
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
          const critical = p.stock_filled <= 0;
          const low = p.stock_filled <= p.reorder_point;
          return (
            <View key={p.id} style={styles.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.name}</Text>
                  <Text style={styles.hpp}>HPP {rupiah(p.hpp)} • Eceran {rupiah(p.price_eceran)}</Text>
                  <Text style={styles.tierPrices}>Warung {rupiah(p.price_warung)} · Pangkalan {rupiah(p.price_pangkalan)} · Korporat {rupiah(p.price_korporat)}</Text>
                </View>
                <Badge text={CATEGORY_LABELS[p.category]} bg={colors.brandTertiary} fg={colors.onBrandTertiary} />
              </View>
              <View style={styles.statRow}>
                <Stat label="Tersisa" value={p.stock_filled} color={low ? colors.error : colors.success} />
                <Stat label="Terjual" value={p.total_sold || 0} color={colors.onSurfaceSecondary} />
                {p.category !== "refill" && (
                  <Stat label="Wadah Kosong" value={p.stock_empty} color={colors.assetGallon} />
                )}
                <Stat label="Min. Stok" value={p.reorder_point} color={colors.muted} />
              </View>
              {low && (
                <View style={[styles.lowBanner, { backgroundColor: critical ? colors.error : colors.warning }]}>
                  <Icon name="alert-circle" size={14} color={colors.onError} />
                  <Text style={styles.lowText}>{critical ? "STOK KRITIS — Habis!" : "Perlu Reorder"}</Text>
                  {canEdit && (
                    <Pressable testID={`po-${p.id}`} onPress={() => makePO(p)} style={styles.poBtn}>
                      <Text style={styles.poBtnText}>Buat PO</Text>
                    </Pressable>
                  )}
                </View>
              )}
              {canEdit && (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <Pressable testID={`edit-${p.id}`} onPress={() => openEdit(p)} style={styles.actionBtn}>
                    <Icon name="pricetag-outline" size={16} color={colors.brandPrimary} />
                    <Text style={styles.actionText}>Edit Harga</Text>
                  </Pressable>
                  <Pressable testID={`adjust-${p.id}`} onPress={() => setAdjust(p)} style={styles.actionBtn}>
                    <Icon name="create-outline" size={16} color={colors.brandPrimary} />
                    <Text style={styles.actionText}>Sesuaikan Stok</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
        {filtered.length === 0 && <EmptyState icon="cube-outline" title="Belum ada produk" subtitle="Tambah produk/aset baru" />}
      </ScrollView>

      {/* Product add/edit modal */}
      <Modal visible={prodModal} animationType="slide" transparent onRequestClose={() => setProdModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setProdModal(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, maxHeight: "88%" }]}>
          <Text style={styles.sheetTitle}>{editId ? "Edit Produk & Harga" : "Tambah Produk"}</Text>
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
            <Field label="Harga Beli / Supplier (HPP dasar)" value={form.cost_price} onChangeText={(v: string) => set("cost_price", v)} keyboardType="numeric" placeholder="16000" testID="pf-cost" />
            <Field label="Biaya Armada / Ongkir per unit" value={form.freight_cost} onChangeText={(v: string) => set("freight_cost", v)} keyboardType="numeric" placeholder="1000" />
            <Field label="Penyusutan Aset per unit" value={form.depreciation_cost} onChangeText={(v: string) => set("depreciation_cost", v)} keyboardType="numeric" placeholder="500" />
            <Field label="Harga Jual Eceran / Toko" value={form.price_eceran} onChangeText={(v: string) => set("price_eceran", v)} keyboardType="numeric" placeholder="22000" testID="pf-price-eceran" />
            <Field label="Harga Delivery / Warung" value={form.price_warung} onChangeText={(v: string) => set("price_warung", v)} keyboardType="numeric" placeholder="20000" testID="pf-price-warung" />
            <Field label="Harga B2B / Pangkalan" value={form.price_pangkalan} onChangeText={(v: string) => set("price_pangkalan", v)} keyboardType="numeric" placeholder="18500" testID="pf-price-pangkalan" />
            <Field label="Harga Grosir / Korporat" value={form.price_korporat} onChangeText={(v: string) => set("price_korporat", v)} keyboardType="numeric" placeholder="18000" testID="pf-price-korporat" />
            <Field label="Deposit Wadah" value={form.deposit_amount} onChangeText={(v: string) => set("deposit_amount", v)} keyboardType="numeric" placeholder="150000" />
            <Field label="Stok Isi" value={form.stock_filled} onChangeText={(v: string) => set("stock_filled", v)} keyboardType="numeric" placeholder="100" />
            <Field label="Stok Kosong" value={form.stock_empty} onChangeText={(v: string) => set("stock_empty", v)} keyboardType="numeric" placeholder="40" />
            <Field label="Batas Stok Minimum (Reorder Point)" value={form.reorder_point} onChangeText={(v: string) => set("reorder_point", v)} keyboardType="numeric" placeholder="10" testID="pf-reorder" />
            <AppButton title={editId ? "Simpan Perubahan" : "Simpan Produk"} onPress={saveProduct} loading={saving} icon="save-outline" testID="save-product-button" />
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

          <DeltaStepper
            label="Stok Isi (siap jual)"
            current={adjust?.stock_filled ?? 0}
            value={adjFilled}
            onChange={setAdjFilled}
            testID="adj-filled"
            colors={colors}
          />
          <DeltaStepper
            label="Jumlah Terjual (akumulasi)"
            current={adjust?.total_sold ?? 0}
            value={adjSold}
            onChange={setAdjSold}
            testID="adj-sold"
            colors={colors}
          />
          {adjust?.category !== "refill" && (
            <DeltaStepper
              label="Wadah Kosong (tabung/galon)"
              current={adjust?.stock_empty ?? 0}
              value={adjEmpty}
              onChange={setAdjEmpty}
              testID="adj-empty"
              colors={colors}
            />
          )}

          <AppButton title="Simpan Perubahan" onPress={saveAdjust} icon="checkmark" testID="save-adjust-button" style={{ marginTop: 8 }} />
        </View>
      </Modal>

      {/* Purchase order drafts modal */}
      <Modal visible={showPO} animationType="slide" transparent onRequestClose={() => setShowPO(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowPO(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, maxHeight: "80%" }]}>
          <Text style={styles.sheetTitle}>Draft Order ke Supplier (PO)</Text>
          <ScrollView>
            {draftPOs.length === 0 ? <Text style={styles.sheetSub}>Belum ada draft PO. Buat dari produk yang perlu reorder.</Text> : draftPOs.map((po) => (
              <View key={po.id} style={styles.poRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{po.product_name}</Text>
                  <Text style={styles.hpp}>Qty {po.qty} • Estimasi {rupiah(po.est_cost)}</Text>
                </View>
                <Pressable testID={`receive-po-${po.id}`} onPress={() => receivePO(po)} style={styles.receiveBtn}>
                  <Text style={styles.receiveText}>Terima Stok</Text>
                </Pressable>
              </View>
            ))}
            <View style={{ height: 20 }} />
          </ScrollView>
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
  poBadge: { position: "absolute", top: -4, right: -4, backgroundColor: c.error, borderRadius: 999, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  poBadgeText: { color: c.onError, fontSize: 10, fontWeight: "800" },
  segWrap: { height: 56, justifyContent: "center", backgroundColor: c.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: c.border },
  segContent: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  chip: { height: 36, paddingHorizontal: 16, borderRadius: 999, backgroundColor: c.surfaceTertiary, justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: c.brandPrimary },
  chipText: { color: c.onSurfaceTertiary, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: c.onBrandPrimary },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: c.border },
  name: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  hpp: { fontSize: 12, color: c.muted, marginTop: 2 },
  tierPrices: { fontSize: 11, color: c.muted, marginTop: 2 },
  statRow: { flexDirection: "row", marginTop: 14, gap: 8 },
  stat: { flex: 1, alignItems: "center", backgroundColor: c.surfaceTertiary, borderRadius: 10, paddingVertical: 10 },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 10, color: c.muted, marginTop: 2 },
  lowBanner: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, padding: 8, marginTop: 10 },
  lowText: { color: c.onError, fontSize: 12, fontWeight: "700", flex: 1 },
  poBtn: { backgroundColor: "rgba(255,255,255,0.25)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  poBtnText: { color: c.onError, fontSize: 11, fontWeight: "800" },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: c.brandTertiary },
  actionText: { color: c.brandPrimary, fontWeight: "700", fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: c.onSurface, marginBottom: 4 },
  sheetSub: { fontSize: 13, color: c.muted, marginBottom: 14 },
  fieldLabel: { color: c.onSurfaceSecondary, fontSize: 13, fontWeight: "600", marginBottom: 6 },
  catBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: c.surfaceTertiary, alignItems: "center" },
  catBtnActive: { backgroundColor: c.brandPrimary },
  catBtnText: { fontSize: 11, fontWeight: "600", color: c.onSurfaceTertiary },
  catBtnTextActive: { color: c.onBrandPrimary },
  poRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.divider, gap: 10 },
  receiveBtn: { backgroundColor: c.brandPrimary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  receiveText: { color: c.onBrandPrimary, fontWeight: "700", fontSize: 12 },
}));
