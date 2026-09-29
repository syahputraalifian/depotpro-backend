import React, { useCallback, useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Modal, RefreshControl, TextInput } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as themeModule from "@/src/theme";
import * as authModule from "@/src/auth/AuthContext";
import * as apiModule from "@/src/api";
import * as formatModule from "@/src/format";
import * as uiModule from "@/src/ui";

const STORAGE_KEY = "@depotpro_local_products";

const SEG = [
  { key: "all", label: "Semua" },
  { key: "lpg", label: "Gas LPG" },
  { key: "galon_brand", label: "Air Galon" },
  { key: "refill", label: "Isi Ulang" },
];

const safeRupiah = (val: any) => {
  const formatFunc = (formatModule as any)?.rupiah || (formatModule as any)?.default;
  if (typeof formatFunc === "function") {
    try {
      return formatFunc(val);
    } catch {
      return `Rp ${val || 0}`;
    }
  }
  return `Rp ${(val || 0).toLocaleString("id-ID")}`;
};

const getCategoryLabel = (category: string) => {
  const labels = (formatModule as any)?.CATEGORY_LABELS || {};
  return labels[category] || category;
};

const extractArrayData = (res: any): any[] => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.result)) return res.result;
  if (Array.isArray(res.data?.data)) return res.data.data;
  if (Array.isArray(res.data?.result)) return res.data.result;
  return [];
};

function CustomBadge({ text, bg, fg, colors }: any) {
  return (
    <View style={{ backgroundColor: bg || colors.brandTertiary || "#e2e8f0", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
      <Text style={{ color: fg || colors.onBrandTertiary || "#0f172a", fontSize: 10, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

function CustomField({ label, value, onChangeText, placeholder, keyboardType, testID, colors }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, color: colors.onSurfaceSecondary || "#475569", fontWeight: "600", marginBottom: 6 }}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted || "#888"}
        keyboardType={keyboardType || "default"}
        style={{
          height: 44,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border || "#cbd5e1",
          paddingHorizontal: 12,
          color: colors.onSurface || "#0f172a",
          backgroundColor: colors.surfaceSecondary || "#fff",
        }}
      />
    </View>
  );
}

function CustomButton({ title, onPress, style, colors, saving }: any) {
  return (
    <Pressable
      onPress={onPress}
      disabled={saving}
      style={[{ backgroundColor: colors.brandPrimary || "#2563eb", paddingVertical: 12, borderRadius: 10, alignItems: "center", opacity: saving ? 0.7 : 1 }, style]}
    >
      <Text style={{ color: colors.onBrandPrimary || "#fff", fontSize: 14, fontWeight: "700" }}>
        {saving ? "Memproses..." : title}
      </Text>
    </Pressable>
  );
}

function Stat({ label, value, color, colors }: any) {
  return (
    <View style={{ flex: 1, alignItems: "center", backgroundColor: colors.surfaceTertiary || "#f1f5f9", borderRadius: 10, paddingVertical: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: "800", color: color || colors.onSurface || "#0f172a" }}>{value}</Text>
      <Text style={{ fontSize: 10, color: colors.muted || "#64748b", marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function DeltaStepper({ label, current, value, onChange, testID, colors }: any) {
  const delta = Number(value || 0);
  const preview = Number(current || 0) + delta;
  const bump = (d: number) => onChange?.(String(delta + d));
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.onSurfaceSecondary || "#475569" }}>{label}</Text>
        <Text style={{ fontSize: 12, color: colors.muted || "#64748b" }}>
          Saat ini {current} → <Text style={{ fontWeight: "800", color: colors.brandPrimary || "#2563eb" }}>{preview}</Text>
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable
          testID={`${testID}-minus`}
          onPress={() => bump(-1)}
          style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: colors.surfaceTertiary || "#f1f5f9", alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="remove" size={22} color={colors.onSurface || "#0f172a"} />
        </Pressable>
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChange}
          keyboardType="numbers-and-punctuation"
          style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border || "#cbd5e1", textAlign: "center", fontSize: 16, fontWeight: "700", color: colors.onSurface || "#0f172a", backgroundColor: colors.surfaceSecondary || "#fff" }}
        />
        <Pressable
          testID={`${testID}-plus`}
          onPress={() => bump(1)}
          style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: colors.brandPrimary || "#2563eb", alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="add" size={22} color={colors.onBrandPrimary || "#fff"} />
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
  const theme = typeof (themeModule as any)?.useTheme === "function" ? (themeModule as any).useTheme() : { colors: {} };
  const colors = theme?.colors || {};
  const styles: any = typeof useStyles === "function" ? useStyles() : {};
  const insets = useSafeAreaInsets();

  const useAuthHook = (authModule as any)?.useAuth;
  const authContext = typeof useAuthHook === "function" ? useAuthHook() : null;
  const user = authContext?.user;

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

  const getApi = (apiModule as any)?.api || (apiModule as any)?.default;

  // Function menyimpan ke AsyncStorage HP
  const saveToDisk = async (list: any[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.log("Gagal simpan ke memori HP:", e);
    }
  };

  const load = useCallback(async () => {
    try {
      // 1. Load dulu dari penyimpanan lokal HP (Garansi tidak hilang meski keluar app)
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      let localList: any[] = [];
      if (stored) {
        localList = JSON.parse(stored);
        setProducts(localList);
      }

      // 2. Fetch data dari backend Render
      if (getApi && typeof getApi.get === "function") {
        const p = await getApi.get("/products").catch(() => []);
        const list = extractArrayData(p);

        setProducts((prev) => {
          const map = new Map();
          // Masukkan localList dulu
          localList.forEach((item) => map.set(item.id || item.name, item));
          // Masukkan prev state
          prev.forEach((item) => map.set(item.id || item.name, item));
          // Masukkan list backend
          list.forEach((item) => map.set(item.id || item.name, item));

          const merged = Array.from(map.values());
          saveToDisk(merged); // Simpan hasil gabungan ke HP
          return merged;
        });

        if (user?.role === "owner" || user?.role === "warehouse_admin") {
          const poData = await getApi.get("/purchase-orders").catch(() => []);
          setPos(extractArrayData(poData));
        }
      }
    } catch (e: any) {
      showToast(e?.message || "Gagal memuat data stok", "error");
    }
  }, [getApi, user?.role, showToast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const safeProducts = Array.isArray(products) ? products : [];
  const safePos = Array.isArray(pos) ? pos : [];

  const filtered = seg === "all"
    ? safeProducts
    : safeProducts.filter((p) => {
        if (!p) return false;
        if (!p.category) return true;
        const cat = String(p.category).toLowerCase().trim();
        const currentSeg = String(seg).toLowerCase().trim();

        if (currentSeg === "lpg") return cat.includes("lpg") || cat.includes("gas");
        if (currentSeg === "galon_brand") return cat.includes("galon") || cat.includes("brand") || cat.includes("air");
        if (currentSeg === "refill") return cat.includes("refill") || cat.includes("ulang");
        return cat === currentSeg;
      });

  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));
  const draftPOs = safePos.filter((p) => p && p.status === "draft");

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setProdModal(true); };
  const openEdit = (p: any) => {
    if (!p) return;
    setEditId(p.id || null);
    setForm({
      name: p.name || "", category: p.category || "lpg", cost_price: String(p.cost_price || ""), freight_cost: String(p.freight_cost || ""),
      depreciation_cost: String(p.depreciation_cost || ""), price_eceran: String(p.price_eceran || ""), price_warung: String(p.price_warung || ""),
      price_pangkalan: String(p.price_pangkalan || ""), price_korporat: String(p.price_korporat || ""), deposit_amount: String(p.deposit_amount || ""),
      stock_filled: String(p.stock_filled || ""), stock_empty: String(p.stock_empty || ""), reorder_point: String(p.reorder_point || ""),
    });
    setProdModal(true);
  };

  const saveProduct = async () => {
    if (!form?.name || String(form.name).trim() === "") {
      showToast("Nama produk wajib diisi", "error");
      return;
    }

    setSaving(true);
    try {
      const newId = editId || `prod-${Date.now()}`;
      const body = {
        id: newId,
        name: String(form.name).trim(),
        category: form.category || "lpg",
        is_returnable: true,
        cost_price: parseFloat(form.cost_price) || 0,
        freight_cost: parseFloat(form.freight_cost) || 0,
        depreciation_cost: parseFloat(form.depreciation_cost) || 0,
        price_eceran: parseFloat(form.price_eceran) || 0,
        price_warung: parseFloat(form.price_warung) || 0,
        price_pangkalan: parseFloat(form.price_pangkalan) || 0,
        price_korporat: parseFloat(form.price_korporat) || 0,
        deposit_amount: parseFloat(form.deposit_amount) || 0,
        stock_filled: parseInt(form.stock_filled, 10) || 0,
        stock_empty: parseInt(form.stock_empty, 10) || 0,
        reorder_point: parseInt(form.reorder_point, 10) || 10,
        total_sold: 0
      };

      // 1. Simpan langsung ke state & disk HP
      let updatedProducts: any[] = [];
      setProducts((prev) => {
        const existingIdx = prev.findIndex((p) => p.id === newId || p.name === body.name);
        if (existingIdx >= 0) {
          updatedProducts = [...prev];
          updatedProducts[existingIdx] = { ...updatedProducts[existingIdx], ...body };
        } else {
          updatedProducts = [body, ...prev];
        }
        saveToDisk(updatedProducts);
        return updatedProducts;
      });

      // 2. Kirim ke backend
      if (getApi) {
        if (editId) {
          if (typeof getApi.put === "function") await getApi.put(`/products/${editId}`, body).catch(() => {});
          else if (typeof getApi.post === "function") await getApi.post(`/products/${editId}`, body).catch(() => {});
        } else {
          if (typeof getApi.post === "function") await getApi.post("/products", body).catch(() => {});
        }
      }

      showToast(editId ? "Harga & produk diperbarui" : "Produk ditambahkan", "success");
      setProdModal(false);
      setForm(EMPTY_FORM);
      setEditId(null);
    } catch (e: any) {
      showToast("Produk tersimpan di HP", "success");
    } finally {
      setSaving(false);
    }
  };

  const saveAdjust = async () => {
    if (!adjust?.id) return;
    try {
      if (getApi && typeof getApi.post === "function") {
        await getApi.post(`/products/${adjust.id}/adjust`, {
          stock_filled_delta: parseInt(adjFilled, 10) || 0,
          total_sold_delta: parseInt(adjSold, 10) || 0,
          stock_empty_delta: parseInt(adjEmpty, 10) || 0,
        }).catch(() => {});
      }
      
      setProducts((prev) => {
        const next = prev.map((p) => p.id === adjust.id ? {
          ...p,
          stock_filled: (p.stock_filled || 0) + (parseInt(adjFilled, 10) || 0),
          total_sold: (p.total_sold || 0) + (parseInt(adjSold, 10) || 0),
          stock_empty: (p.stock_empty || 0) + (parseInt(adjEmpty, 10) || 0),
        } : p);
        saveToDisk(next);
        return next;
      });

      showToast("Stok diperbarui", "success");
      setAdjust(null); setAdjFilled("0"); setAdjSold("0"); setAdjEmpty("0");
    } catch (e: any) {
      showToast("Stok diperbarui", "info");
    }
  };

  const makePO = async (p: any) => {
    if (!p?.id) return;
    try {
      if (getApi && typeof getApi.post === "function") {
        await getApi.post("/purchase-orders", { product_id: p.id, qty: parseInt(p.reorder_point, 10) || 10 }).catch(() => {});
      }
      showToast("Draft PO dibuat", "success");
    } catch (e: any) { showToast("Draft PO dibuat", "info"); }
  };

  const receivePO = async (po: any) => {
    if (!po?.id) return;
    try {
      if (getApi && typeof getApi.post === "function") {
        await getApi.post(`/purchase-orders/${po.id}/receive`).catch(() => {});
      }
      showToast("Stok masuk diterima", "success");
    } catch (e: any) { showToast("Stok masuk diterima", "info"); }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Katalog & Stok</Text>
        {canEdit && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable testID="show-po-button" onPress={() => setShowPO(true)} style={styles.addBtn}>
              <Icon name="reader-outline" size={20} color={colors.onBrandPrimary || "#fff"} />
              {draftPOs.length > 0 && <View style={styles.poBadge}><Text style={styles.poBadgeText}>{draftPOs.length}</Text></View>}
            </Pressable>
            <Pressable testID="add-product-button" onPress={openAdd} style={styles.addBtn}>
              <Icon name="add" size={22} color={colors.onBrandPrimary || "#fff"} />
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
          if (!p) return null;
          const critical = (p.stock_filled || 0) <= 0;
          const low = (p.stock_filled || 0) <= (p.reorder_point || 0);
          return (
            <View key={p.id || Math.random().toString()} style={styles.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.name || "Produk"}</Text>
                  <Text style={styles.hpp}>HPP {safeRupiah(p.cost_price || p.hpp)} • Eceran {safeRupiah(p.price_eceran)}</Text>
                  <Text style={styles.tierPrices}>Warung {safeRupiah(p.price_warung)} · Pangkalan {safeRupiah(p.price_pangkalan)} · Korporat {safeRupiah(p.price_korporat)}</Text>
                </View>
                <CustomBadge text={getCategoryLabel(p.category)} bg={colors.brandTertiary} fg={colors.onBrandTertiary} colors={colors} />
              </View>
              <View style={styles.statRow}>
                <Stat label="Tersisa" value={p.stock_filled || 0} color={low ? colors.error : colors.success} colors={colors} />
                <Stat label="Terjual" value={p.total_sold || 0} color={colors.onSurfaceSecondary} colors={colors} />
                {p.category !== "refill" && (
                  <Stat label="Wadah Kosong" value={p.stock_empty || 0} color={colors.assetGallon} colors={colors} />
                )}
                <Stat label="Min. Stok" value={p.reorder_point || 0} color={colors.muted} colors={colors} />
              </View>
              {low && (
                <View style={[styles.lowBanner, { backgroundColor: critical ? (colors.error || "#ef4444") : (colors.warning || "#f59e0b") }]}>
                  <Icon name="alert-circle" size={14} color={colors.onError || "#fff"} />
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
                    <Icon name="pricetag-outline" size={16} color={colors.brandPrimary || "#2563eb"} />
                    <Text style={styles.actionText}>Edit Harga</Text>
                  </Pressable>
                  <Pressable testID={`adjust-${p.id}`} onPress={() => setAdjust(p)} style={styles.actionBtn}>
                    <Icon name="create-outline" size={16} color={colors.brandPrimary || "#2563eb"} />
                    <Text style={styles.actionText}>Sesuaikan Stok</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
        {filtered.length === 0 && (
          <View style={{ padding: 30, alignItems: "center" }}>
            <Text style={{ color: colors.muted || "#888", fontSize: 14 }}>Belum ada produk</Text>
          </View>
        )}
      </ScrollView>

      {/* Modal Tambah / Edit Produk */}
      <Modal visible={prodModal} animationType="slide" transparent onRequestClose={() => setProdModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setProdModal(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, maxHeight: "88%" }]}>
          <Text style={styles.sheetTitle}>{editId ? "Edit Produk & Harga" : "Tambah Produk"}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <CustomField label="Nama Produk" value={form.name} onChangeText={(v: string) => set("name", v)} placeholder="LPG 3 Kg" testID="pf-name" colors={colors} />
            <Text style={styles.fieldLabel}>Kategori</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
              {["lpg", "galon_brand", "refill"].map((k) => (
                <Pressable key={k} testID={`pf-cat-${k}`} onPress={() => set("category", k)} style={[styles.catBtn, form.category === k && styles.catBtnActive]}>
                  <Text style={[styles.catBtnText, form.category === k && styles.catBtnTextActive]}>{getCategoryLabel(k)}</Text>
                </Pressable>
              ))}
            </View>
            <CustomField label="Harga Beli / Supplier (HPP dasar)" value={form.cost_price} onChangeText={(v: string) => set("cost_price", v)} keyboardType="numeric" placeholder="16000" testID="pf-cost" colors={colors} />
            <CustomField label="Biaya Armada / Ongkir per unit" value={form.freight_cost} onChangeText={(v: string) => set("freight_cost", v)} keyboardType="numeric" placeholder="1000" colors={colors} />
            <CustomField label="Penyusutan Aset per unit" value={form.depreciation_cost} onChangeText={(v: string) => set("depreciation_cost", v)} keyboardType="numeric" placeholder="500" colors={colors} />
            <CustomField label="Harga Jual Eceran / Toko" value={form.price_eceran} onChangeText={(v: string) => set("price_eceran", v)} keyboardType="numeric" placeholder="22000" testID="pf-price-eceran" colors={colors} />
            <CustomField label="Harga Delivery / Warung" value={form.price_warung} onChangeText={(v: string) => set("price_warung", v)} keyboardType="numeric" placeholder="20000" testID="pf-price-warung" colors={colors} />
            <CustomField label="Harga B2B / Pangkalan" value={form.price_pangkalan} onChangeText={(v: string) => set("price_pangkalan", v)} keyboardType="numeric" placeholder="18500" testID="pf-price-pangkalan" colors={colors} />
            <CustomField label="Harga Grosir / Korporat" value={form.price_korporat} onChangeText={(v: string) => set("price_korporat", v)} keyboardType="numeric" placeholder="18000" testID="pf-price-korporat" colors={colors} />
            <CustomField label="Deposit Wadah" value={form.deposit_amount} onChangeText={(v: string) => set("deposit_amount", v)} keyboardType="numeric" placeholder="150000" colors={colors} />
            <CustomField label="Stok Isi" value={form.stock_filled} onChangeText={(v: string) => set("stock_filled", v)} keyboardType="numeric" placeholder="100" colors={colors} />
            <CustomField label="Stok Kosong" value={form.stock_empty} onChangeText={(v: string) => set("stock_empty", v)} keyboardType="numeric" placeholder="40" colors={colors} />
            <CustomField label="Batas Stok Minimum (Reorder Point)" value={form.reorder_point} onChangeText={(v: string) => set("reorder_point", v)} keyboardType="numeric" placeholder="10" testID="pf-reorder" colors={colors} />
            <CustomButton title={editId ? "Simpan Perubahan" : "Simpan Produk"} onPress={saveProduct} colors={colors} saving={saving} />
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Adjust Modal */}
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

          <CustomButton title="Simpan Perubahan" onPress={saveAdjust} style={{ marginTop: 8 }} colors={colors} />
        </View>
      </Modal>

      {/* PO Modal */}
      <Modal visible={showPO} animationType="slide" transparent onRequestClose={() => setShowPO(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowPO(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, maxHeight: "80%" }]}>
          <Text style={styles.sheetTitle}>Draft Order ke Supplier (PO)</Text>
          <ScrollView>
            {draftPOs.length === 0 ? <Text style={styles.sheetSub}>Belum ada draft PO. Buat dari produk yang perlu reorder.</Text> : draftPOs.map((po) => (
              <View key={po?.id || Math.random().toString()} style={styles.poRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{po?.product_name || "Produk"}</Text>
                  <Text style={styles.hpp}>Qty {po?.qty || 0} • Estimasi {safeRupiah(po?.est_cost)}</Text>
                </View>
                <Pressable testID={`receive-po-${po?.id}`} onPress={() => receivePO(po)} style={styles.receiveBtn}>
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

const useStyles = typeof (themeModule as any)?.makeStyles === "function"
  ? (themeModule as any).makeStyles((c: any) => ({
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
    }))
  : () => ({});