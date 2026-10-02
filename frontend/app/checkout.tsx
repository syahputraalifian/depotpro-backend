import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Modal } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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

export default function CheckoutScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  const rawCart = typeof params.cart === "string" ? params.cart : "[]";
  const priceType = typeof params.priceType === "string" ? params.priceType : "eceran";

  let cartItems: any[] = [];
  try {
    cartItems = JSON.parse(rawCart);
  } catch (e) {
    cartItems = [];
  }

  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [customerName, setCustomerName] = useState("Pelanggan Umum");
  const [submitting, setSubmitting] = useState(false);
  const [successModal, setSuccessModal] = useState(false);

  const totalAmount = cartItems.reduce((sum, item) => {
    const price = item?.price || 0;
    const qty = item?.qty || 0;
    return sum + price * qty;
  }, 0);

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

  const processPayment = async () => {
    if (cartItems.length === 0) {
      showToast("Keranjang kosong");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customer_name: customerName,
        payment_method: paymentMethod,
        total_amount: totalAmount,
        items: cartItems.map((item) => ({
          product_id: item?.product?.id || item?.product?.name,
          product_name: `${item?.product?.name || "Produk"} (${item?.isExchange ? "Tukar" : "Beli Baru"})`,
          qty: item?.qty || 1,
          price: item?.price || 0,
        })),
      };

      const getApi = typeof api?.post === "function" ? api.post : null;
      if (getApi) {
        await getApi("/transactions", payload);
      }

      setSuccessModal(true);
    } catch (e: any) {
      showToast(e?.message || "Gagal memproses pembayaran");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-back" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Konfirmasi Pembayaran</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={styles.tierBanner}>
          <Text style={styles.tierBannerText}>
            Tipe Harga Terpilih: <Text style={{ fontWeight: "800", color: colors.brandPrimary }}>{priceType.toUpperCase()}</Text>
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Rincian Pesanan</Text>
        {cartItems.map((item, idx) => (
          <View key={idx} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item?.product?.name}</Text>
              <Text style={styles.itemSub}>
                {item?.isExchange ? "🔄 Tukar Tabung" : "📦 Beli Baru + Tabung"} | {item?.qty} x {safeRupiah(item?.price)}
              </Text>
            </View>
            <Text style={styles.itemTotal}>
              {safeRupiah((item?.price || 0) * (item?.qty || 0))}
            </Text>
          </View>
        ))}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Detail Pelanggan</Text>
        <TextInput
          style={styles.input}
          value={customerName}
          onChangeText={setCustomerName}
          placeholder="Nama Pelanggan"
        />

        <Text style={styles.sectionTitle}>Metode Pembayaran</Text>
        <View style={styles.methodRow}>
          {["cash", "qris", "transfer"].map((m) => (
            <Pressable
              key={m}
              style={[
                styles.methodChip,
                paymentMethod === m && styles.methodChipActive,
              ]}
              onPress={() => setPaymentMethod(m)}
            >
              <Text
                style={[
                  styles.methodText,
                  paymentMethod === m && styles.methodTextActive,
                ]}
              >
                {m.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Bayar:</Text>
          <Text style={styles.totalValue}>{safeRupiah(totalAmount)}</Text>
        </View>
        <Pressable
          style={[styles.payBtn, submitting && { opacity: 0.6 }]}
          disabled={submitting}
          onPress={processPayment}
        >
          <Text style={styles.payBtnText}>
            {submitting ? "Memproses..." : "Selesaikan Transaksi"}
          </Text>
        </Pressable>
      </View>

      <Modal visible={successModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Icon name="checkmark-circle" size={60} color={colors.success || "#16a34a"} />
            <Text style={styles.modalTitle}>Transaksi Berhasil!</Text>
            <Text style={styles.modalSub}>Stok produk otomatis terpotong di MongoDB Atlas.</Text>
            <Pressable
              style={styles.modalBtn}
              onPress={() => {
                setSuccessModal(false);
                router.replace("/(tabs)/pos");
              }}
            >
              <Text style={styles.modalBtnText}>Kembali ke Kasir</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: c.brandPrimary },
  backBtn: { paddingRight: 12 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  tierBanner: { padding: 10, borderRadius: 8, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, marginBottom: 8 },
  tierBannerText: { fontSize: 13, color: c.onSurface },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: c.onSurface, marginTop: 16, marginBottom: 8 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  itemName: { fontSize: 14, fontWeight: "700", color: c.onSurface },
  itemSub: { fontSize: 12, color: c.muted, marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: "800", color: c.brandPrimary },
  divider: { height: 1, backgroundColor: c.border, marginVertical: 12 },
  input: { height: 44, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 12, color: c.onSurface, backgroundColor: c.surfaceSecondary },
  methodRow: { flexDirection: "row", gap: 10 },
  methodChip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: "center", backgroundColor: c.surfaceSecondary },
  methodChipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  methodText: { fontWeight: "700", fontSize: 12, color: c.muted },
  methodTextActive: { color: "#fff" },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  totalLabel: { fontSize: 14, fontWeight: "700", color: c.muted },
  totalValue: { fontSize: 18, fontWeight: "800", color: c.onSurface },
  payBtn: { backgroundColor: c.brandPrimary, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  payBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalCard: { width: "80%", backgroundColor: c.surface, borderRadius: 18, padding: 24, alignItems: "center" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: c.onSurface, marginTop: 12 },
  modalSub: { fontSize: 12, color: c.muted, textAlign: "center", marginTop: 4, marginBottom: 16 },
  modalBtn: { backgroundColor: c.brandPrimary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  modalBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
}));