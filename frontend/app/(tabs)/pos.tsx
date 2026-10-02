import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { api } from "@/src/api";
import * as uiModule from "@/src/ui";

export default function PosScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // State Keranjang & Pelanggan Terpilih
  const [cart, setCart] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

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

  const fetchData = async () => {
    setLoading(true);
    try {
      const getApi = typeof api?.get === "function" ? api.get : null;
      if (getApi) {
        const [prodRes, custRes] = await Promise.all([
          getApi("/products"),
          getApi("/customers"),
        ]);

        const prodList = Array.isArray(prodRes) ? prodRes : prodRes?.data || [];
        const custList = Array.isArray(custRes) ? custRes : custRes?.data || [];

        setProducts(prodList);
        setCustomers(custList);

        if (!selectedCustomer) {
          setSelectedCustomer({ name: "Pelanggan Umum / Tunai", tier: "eceran" });
        }
      }
    } catch (e) {
      console.log("Error loading POS data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addToCart = (product: any) => {
    const pId = product.id || product._id;
    const existingIndex = cart.findIndex((item) => (item.id || item._id) === pId);

    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].qty += 1;
      setCart(updated);
    } else {
      setCart([...cart, { ...product, qty: 1 }]);
    }
  };

  // FITUR KURANG DAN TAMBAH QTY DI KERANJANG
  const updateQty = (index: number, delta: number) => {
    const updated = [...cart];
    const newQty = updated[index].qty + delta;

    if (newQty <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index].qty = newQty;
    }
    setCart(updated);
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.price || 0) * item.qty, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      showToast("Keranjang transaksi masih kosong");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customer_id: selectedCustomer?.id || selectedCustomer?._id || null,
        customer_name: selectedCustomer?.name || "Pelanggan Umum / Tunai",
        payment_method: paymentMethod,
        total_amount: totalAmount,
        items: cart.map((item) => ({
          product_id: item.id || item._id,
          product_name: item.name,
          qty: item.qty,
          price: item.price || 0,
        })),
      };

      const postApi = typeof api?.post === "function" ? api.post : null;
      if (postApi) {
        await postApi("/transactions", payload);
      }

      showToast("Transaksi berhasil disimpan!");
      setCart([]);
      fetchData();
    } catch (e: any) {
      showToast(e?.message || "Gagal memproses transaksi");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCustomers = customers.filter((c) =>
    (c.name || "").toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone || "").includes(customerSearch)
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kasir & Penjualan (POS)</Text>
        <Pressable onPress={fetchData} style={styles.refreshBtn}>
          <Icon name="refresh-outline" size={20} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.customerBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.customerLabel}>Pelanggan Terpilih:</Text>
          <Text style={styles.customerName}>
            {selectedCustomer?.name || "Pelanggan Umum"}
            {selectedCustomer?.tier ? ` (${selectedCustomer.tier.toUpperCase()})` : ""}
          </Text>
        </View>
        <Pressable
          onPress={() => setCustomerModalVisible(true)}
          style={styles.selectCustomerBtn}
        >
          <Icon name="person" size={16} color="#fff" />
          <Text style={styles.selectCustomerBtnText}>Pilih Pelanggan</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
          <Text style={styles.loadingText}>Memuat Produk Kasir...</Text>
        </View>
      ) : (
        <View style={{ flex: 1, flexDirection: "column" }}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
            <Text style={styles.sectionTitle}>Pilih Produk Depot</Text>
            <View style={styles.productGrid}>
              {products.map((p) => (
                <Pressable
                  key={p.id || p._id}
                  style={styles.productCard}
                  onPress={() => addToCart(p)}
                >
                  <Text style={styles.productTitle}>{p.name}</Text>
                  <Text style={styles.productPrice}>
                    Rp {(p.price || 0).toLocaleString("id-ID")}
                  </Text>
                  <Text style={styles.productStock}>
                    Stok Isi: {p.stock_filled || 0}
                  </Text>
                  <View style={styles.addCartBadge}>
                    <Icon name="add" size={16} color="#fff" />
                  </View>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {cart.length > 0 && (
            <View style={styles.cartFooter}>
              <Text style={styles.cartHeaderTitle}>
                Item Transaksi ({cart.reduce((sum, i) => sum + i.qty, 0)})
              </Text>

              <ScrollView style={{ maxHeight: 120, marginVertical: 6 }}>
                {cart.map((item, idx) => (
                  <View key={item.id || item._id || idx} style={styles.cartRow}>
                    <Text style={{ flex: 1, fontSize: 13, color: colors.onSurface }}>
                      {item.name}
                    </Text>

                    {/* Tombol Kurang (-) dan Tambah (+) */}
                    <View style={styles.qtyControl}>
                      <Pressable onPress={() => updateQty(idx, -1)} style={styles.qtyBtn}>
                        <Text style={styles.qtyBtnText}>-</Text>
                      </Pressable>
                      <Text style={styles.qtyText}>{item.qty}</Text>
                      <Pressable onPress={() => updateQty(idx, 1)} style={styles.qtyBtn}>
                        <Text style={styles.qtyBtnText}>+</Text>
                      </Pressable>
                    </View>

                    <Text style={styles.cartItemPrice}>
                      Rp {((item.price || 0) * item.qty).toLocaleString("id-ID")}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Bayar:</Text>
                <Text style={styles.totalValue}>
                  Rp {totalAmount.toLocaleString("id-ID")}
                </Text>
              </View>

              <Pressable
                style={[styles.checkoutBtn, submitting && { opacity: 0.6 }]}
                disabled={submitting}
                onPress={handleCheckout}
              >
                <Text style={styles.checkoutBtnText}>
                  {submitting ? "Memproses Transaksi..." : "Proses & Simpan Transaksi"}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      <Modal visible={customerModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pilih Pelanggan Transaksi</Text>
              <Pressable onPress={() => setCustomerModalVisible(false)}>
                <Icon name="close" size={24} color={colors.onSurface} />
              </Pressable>
            </View>

            <View style={{ padding: 12 }}>
              <TextInput
                style={styles.searchInput}
                placeholder="Cari nama pelanggan / HP..."
                value={customerSearch}
                onChangeText={setCustomerSearch}
              />
            </View>

            <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
              <Pressable
                style={styles.customerOptionCard}
                onPress={() => {
                  setSelectedCustomer({ name: "Pelanggan Umum / Tunai", tier: "eceran" });
                  setCustomerModalVisible(false);
                }}
              >
                <Text style={styles.customerOptionName}>Pelanggan Umum / Tunai</Text>
                <Text style={styles.customerOptionSub}>Non-member / Eceran</Text>
              </Pressable>

              {filteredCustomers.map((c) => (
                <Pressable
                  key={c.id || c._id}
                  style={styles.customerOptionCard}
                  onPress={() => {
                    setSelectedCustomer(c);
                    setCustomerModalVisible(false);
                  }}
                >
                  <Text style={styles.customerOptionName}>{c.name}</Text>
                  <Text style={styles.customerOptionSub}>
                    {c.phone || "No HP Kosong"} • Tipe: {(c.tier || "eceran").toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
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
  refreshBtn: { padding: 4 },
  customerBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, backgroundColor: c.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: c.border },
  customerLabel: { fontSize: 10, color: c.muted, fontWeight: "600" },
  customerName: { fontSize: 14, fontWeight: "800", color: c.onSurface },
  selectCustomerBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.brandPrimary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  selectCustomerBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 8, fontSize: 13, color: c.muted },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: c.onSurface, marginBottom: 10 },
  productGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  productCard: { width: "48%", backgroundColor: c.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: c.border, position: "relative" },
  productTitle: { fontSize: 13, fontWeight: "800", color: c.onSurface },
  productPrice: { fontSize: 14, fontWeight: "800", color: c.brandPrimary, marginTop: 4 },
  productStock: { fontSize: 11, color: c.muted, marginTop: 2 },
  addCartBadge: { position: "absolute", bottom: 10, right: 10, backgroundColor: c.brandPrimary, width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  cartFooter: { backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, elevation: 8 },
  cartHeaderTitle: { fontSize: 13, fontWeight: "800", color: c.onSurface },
  cartRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  qtyControl: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 8 },
  qtyBtn: { width: 24, height: 24, backgroundColor: c.surfaceSecondary, borderRadius: 4, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: c.border },
  qtyBtnText: { fontWeight: "800", fontSize: 14, color: c.onSurface },
  qtyText: { fontSize: 13, fontWeight: "700", color: c.onSurface },
  cartItemPrice: { fontSize: 12, fontWeight: "700", color: c.onSurface },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.border },
  totalLabel: { fontSize: 14, fontWeight: "800", color: c.onSurface },
  totalValue: { fontSize: 18, fontWeight: "800", color: c.brandPrimary },
  checkoutBtn: { backgroundColor: c.brandPrimary, paddingVertical: 12, borderRadius: 10, alignItems: "center", marginTop: 10 },
  checkoutBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  modalTitle: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  searchInput: { height: 40, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 10, color: c.onSurface, backgroundColor: c.surfaceSecondary },
  customerOptionCard: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, marginBottom: 8 },
  customerOptionName: { fontSize: 14, fontWeight: "800", color: c.onSurface },
  customerOptionSub: { fontSize: 11, color: c.muted, marginTop: 2 },
}));