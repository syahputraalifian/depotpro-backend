import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { api } from "@/src/api";
import * as formatModule from "@/src/format";
import * as uiModule from "@/src/ui";

const safeRupiah = (val: number) => {
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

export default function StokScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    category: "lpg",
    is_returnable: true,
    cost_price: "16000",
    freight_cost: "1000",
    depreciation_cost: "500",
    price_eceran: "22000",
    price_warung: "20000",
    price_pangkalan: "18500",
    price_korporat: "18000",
    deposit_amount: "150000",
    stock_filled: "50",
    stock_empty: "20",
    reorder_point: "10",
  });

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

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const getApi = typeof api?.get === "function" ? api.get : null;
      if (getApi) {
        const res = await getApi("/products");
        const list = Array.isArray(res) ? res : res?.data || [];
        setProducts(list);
      }
    } catch (e) {
      console.log("Error fetching products:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      name: "",
      category: "lpg",
      is_returnable: true,
      cost_price: "16000",
      freight_cost: "1000",
      depreciation_cost: "500",
      price_eceran: "22000",
      price_warung: "20000",
      price_pangkalan: "18500",
      price_korporat: "18000",
      deposit_amount: "150000",
      stock_filled: "50",
      stock_empty: "20",
      reorder_point: "10",
    });
    setModalVisible(true);
  };

  const openEditModal = (p: any) => {
    const pId = typeof p === "string" ? p : p?.id || p?._id;
    setEditingId(pId);
    setFormData({
      name: p.name || "",
      category: p.category || "lpg",
      is_returnable: p.is_returnable ?? true,
      cost_price: String(p.cost_price || 0),
      freight_cost: String(p.freight_cost || 0),
      depreciation_cost: String(p.depreciation_cost || 0),
      price_eceran: String(p.price_eceran || 0),
      price_warung: String(p.price_warung || 0),
      price_pangkalan: String(p.price_pangkalan || 0),
      price_korporat: String(p.price_korporat || 0),
      deposit_amount: String(p.deposit_amount || 0),
      stock_filled: String(p.stock_filled || 0),
      stock_empty: String(p.stock_empty || 0),
      reorder_point: String(p.reorder_point || 10),
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showToast("Nama produk wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        id: editingId || undefined,
        name: formData.name,
        category: formData.category,
        is_returnable: formData.is_returnable,
        cost_price: parseFloat(formData.cost_price) || 0,
        freight_cost: parseFloat(formData.freight_cost) || 0,
        depreciation_cost: parseFloat(formData.depreciation_cost) || 0,
        price_eceran: parseFloat(formData.price_eceran) || 0,
        price_warung: parseFloat(formData.price_warung) || 0,
        price_pangkalan: parseFloat(formData.price_pangkalan) || 0,
        price_korporat: parseFloat(formData.price_korporat) || 0,
        deposit_amount: parseFloat(formData.deposit_amount) || 0,
        stock_filled: parseInt(formData.stock_filled) || 0,
        stock_empty: parseInt(formData.stock_empty) || 0,
        reorder_point: parseInt(formData.reorder_point) || 10,
      };

      const postApi = typeof api?.post === "function" ? api.post : null;
      if (postApi) {
        await postApi("/products", payload);
      }

      showToast(editingId ? "Produk diperbarui" : "Produk ditambahkan");
      setModalVisible(false);
      fetchProducts();
    } catch (e: any) {
      showToast(e?.message || "Gagal menyimpan produk");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (target?: any) => {
    const idToDelete =
      typeof target === "string"
        ? target
        : target?.id || target?._id || editingId;

    if (!idToDelete) {
      Alert.alert("Error", "ID Produk tidak ditemukan");
      return;
    }

    Alert.alert("Konfirmasi Hapus", "Yakin ingin menghapus produk ini dari database?", [
      { text: "Batal", style: "cancel" },
      {
        text: "HAPUS",
        style: "destructive",
        onPress: async () => {
          setSubmitting(true);
          setProducts((prev) => prev.filter((item) => (item.id || item._id) !== idToDelete));
          setModalVisible(false);

          try {
            const delApi = typeof api?.delete === "function" ? api.delete : null;
            if (delApi) {
              await delApi(`/products/${idToDelete}`);
            }
            showToast("Produk berhasil dihapus");
            fetchProducts();
          } catch (e: any) {
            console.log("Error delete product:", e);
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = (p.name || "").toLowerCase().includes(search.toLowerCase());
      const matchCat = category === "all" || p.category === category;
      return matchSearch && matchCat;
    });
  }, [products, search, category]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manajemen Stok & Gudang</Text>
        <Pressable onPress={openAddModal} style={styles.addHeaderBtn}>
          <Icon name="add-circle" size={24} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari produk / galon..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={colors.muted}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
          {[
            { id: "all", label: "Semua Kategori" },
            { id: "lpg", label: "LPG" },
            { id: "galon_brand", label: "Galon Brand" },
            { id: "refill", label: "Isi Ulang" },
          ].map((c) => (
            <Pressable
              key={c.id}
              style={[
                styles.catChip,
                category === c.id && styles.catChipActive,
              ]}
              onPress={() => setCategory(c.id)}
            >
              <Text style={[styles.catText, category === c.id && styles.catTextActive]}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
          <Text style={styles.loadingText}>Memuat Stok Database...</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 100 }}>
          {filteredProducts.map((p) => {
            const isLow = (p.stock_filled || 0) <= (p.reorder_point || 10);

            return (
              <Pressable
                key={p.id || p._id || p.name}
                style={[styles.stockCard, isLow && styles.stockCardWarning]}
                onPress={() => openEditModal(p)}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productTitle}>{p.name}</Text>
                    <Text style={styles.categorySub}>
                      Kategori: {(p.category || "LPG").toUpperCase()}
                    </Text>
                  </View>
                  <Pressable onPress={() => handleDelete(p.id || p)} style={{ padding: 6 }}>
                    <Icon name="trash-outline" size={22} color="#e11d48" />
                  </Pressable>
                </View>

                <View style={styles.stockMetricRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Stok Terisi</Text>
                    <Text style={[styles.metricValue, { color: colors.brandPrimary }]}>
                      {p.stock_filled || 0}
                    </Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Stok Kosong</Text>
                    <Text style={[styles.metricValue, { color: colors.muted }]}>
                      {p.stock_empty || 0}
                    </Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Total Terjual</Text>
                    <Text style={[styles.metricValue, { color: colors.onSurface }]}>
                      {p.total_sold || 0}
                    </Text>
                  </View>
                </View>

                <View style={styles.priceSummaryRow}>
                  <Text style={styles.priceSummaryText}>
                    Harga Eceran: <Text style={{ fontWeight: "800", color: colors.brandPrimary }}>{safeRupiah(p.price_eceran)}</Text>
                  </Text>
                  <Text style={styles.priceSummaryText}>
                    Modal: {safeRupiah(p.cost_price)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? "Edit Produk / Stok" : "Tambah Produk Baru"}
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color={colors.onSurface} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              <Text style={styles.inputLabel}>Nama Produk</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(val) => setFormData({ ...formData, name: val })}
                placeholder="Contoh: Gas LPG 3 Kg"
              />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Stok Terisi</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={formData.stock_filled}
                    onChangeText={(val) => setFormData({ ...formData, stock_filled: val })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Stok Kosong</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={formData.stock_empty}
                    onChangeText={(val) => setFormData({ ...formData, stock_empty: val })}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Harga Modal (HPP)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={formData.cost_price}
                onChangeText={(val) => setFormData({ ...formData, cost_price: val })}
              />

              <Text style={styles.inputLabel}>Harga Jual Eceran</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={formData.price_eceran}
                onChangeText={(val) => setFormData({ ...formData, price_eceran: val })}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              {editingId && (
                <Pressable
                  style={[styles.deleteBtn, submitting && { opacity: 0.6 }]}
                  disabled={submitting}
                  onPress={() => handleDelete(editingId)}
                >
                  <Text style={styles.deleteBtnText}>Hapus Produk Ini</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.saveBtn, submitting && { opacity: 0.6 }]}
                disabled={submitting}
                onPress={handleSave}
              >
                <Text style={styles.saveBtnText}>
                  {submitting ? "Menyimpan..." : "Simpan Produk"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: c.brandPrimary },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  addHeaderBtn: { padding: 4 },
  searchSection: { paddingHorizontal: 12, paddingTop: 10, backgroundColor: c.surface },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: 10, paddingHorizontal: 10, height: 40, borderWidth: 1, borderColor: c.border },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13, color: c.onSurface },
  catChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  catChipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  catText: { fontSize: 12, fontWeight: "600", color: c.muted },
  catTextActive: { color: "#fff" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 8, fontSize: 13, color: c.muted },
  stockCard: { backgroundColor: c.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: c.border, marginBottom: 10 },
  stockCardWarning: { borderColor: "#e11d48", backgroundColor: "#fff1f2" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  productTitle: { fontSize: 15, fontWeight: "800", color: c.onSurface },
  categorySub: { fontSize: 11, color: c.muted, marginTop: 2 },
  stockMetricRow: { flexDirection: "row", backgroundColor: c.surfaceSecondary, borderRadius: 8, padding: 10, marginBottom: 10 },
  metricItem: { flex: 1, alignItems: "center" },
  metricLabel: { fontSize: 10, color: c.muted, marginBottom: 2 },
  metricValue: { fontSize: 16, fontWeight: "800" },
  priceSummaryRow: { flexDirection: "row", justifyContent: "space-between" },
  priceSummaryText: { fontSize: 12, color: c.muted },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  modalTitle: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  inputLabel: { fontSize: 12, fontWeight: "700", color: c.onSurface, marginTop: 4 },
  input: { height: 42, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 10, color: c.onSurface, backgroundColor: c.surfaceSecondary },
  modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: c.border, gap: 8 },
  deleteBtn: { backgroundColor: "#e11d48", paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  deleteBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  saveBtn: { backgroundColor: c.brandPrimary, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
}));