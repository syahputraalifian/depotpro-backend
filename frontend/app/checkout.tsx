import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
} from "react-native";
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

const PAYMENT_METHODS = [
  { id: "cash", label: "Tunai", icon: "cash-outline" },
  { id: "qris", label: "QRIS", icon: "qr-code-outline" },
  { id: "transfer", label: "Transfer Bank", icon: "card-outline" },
  { id: "receivable", label: "Tempo / Piutang", icon: "time-outline" },
  { id: "deposit", label: "Saldo Deposit", icon: "wallet-outline" },
];

export default function CheckoutScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  // Parsing data cart dari params
  const rawCart = typeof params?.cart === "string" ? params.cart : "[]";
  let initialCart: any[] = [];
  try {
    initialCart = JSON.parse(rawCart);
  } catch {
    initialCart = [];
  }

  const [cart] = useState<any[]>(Array.isArray(initialCart) ? initialCart : []);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [cashAmount, setCashAmount] = useState<string>("");
  const [discountAmount, setDiscountAmount] = useState<string>("0");
  const [note, setNote] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successModal, setSuccessModal] = useState<boolean>(false);
  const [lastTxn, setLastTxn] = useState<any>(null);

  const showToast = useCallback((msg: string) => {
    try {
      const useToastHook = (uiModule as any)?.useToast;
      if (typeof useToastHook === "function") {
        const toast = useToastHook();
        if (typeof toast === "function") toast(msg);
        else if (toast?.show) toast.show(msg);
      }
    } catch {
      console.log("[Toast]:", msg);
    }
  }, []);

  // Fetch daftar pelanggan
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const getApi = typeof api?.get === "function" ? api.get : null;
        if (!getApi) return;
        const res = await getApi("/customers");
        setCustomers(Array.isArray(res) ? res : []);
      } catch {
        // Fallback
      }
    };
    fetchCustomers();
  }, []);

  const subtotal = cart.reduce((sum, item) => {
    const p = item?.price ?? item?.product?.price_eceran ?? item?.product?.price ?? 0;
    return sum + p * (item?.qty || 0);
  }, 0);

  const discount = Number(discountAmount || 0);
  const total = Math.max(0, subtotal - discount);
  const cashGiven = Number(cashAmount || 0);
  const change = Math.max(0, cashGiven - total);

  // Menentukan harga sesuai tingkat pelanggan jika ada
  const getEffectivePrice = (item: any) => {
    const prod = item?.product || {};
    if (!selectedCustomerId) return item?.price ?? prod?.price_eceran ?? prod?.price ?? 0;

    const cust = customers.find((c) => c.id === selectedCustomerId);
    const tier = cust?.tier || "eceran";

    if (tier === "warung" && prod.price_warung) return prod.price_warung;
    if (tier === "pangkalan" && prod.price_pangkalan) return prod.price_pangkalan;
    if (tier === "korporat" && prod.price_korporat) return prod.price_korporat;
    return prod.price_eceran ?? prod.price ?? 0;
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      showToast("Keranjang kosong");
      return;
    }

    if ((paymentMethod === "receivable" || paymentMethod === "deposit") && !selectedCustomerId) {
      showToast("Pilih pelanggan untuk pembayaran Tempo / Deposit");
      return;
    }

    if (paymentMethod === "cash" && cashGiven < total) {
      showToast("Uang tunai kurang dari total pembayaran");
      return;
    }

    setSubmitting(true);
    try {
      const postApi = typeof api?.post === "function" ? api.post : null;
      if (!postApi) throw new Error("API service tidak tersedia");

      const payload = {
        customer_id: selectedCustomerId || null,
        payment_method: paymentMethod,
        discount_amount: discount,
        amount_paid: paymentMethod === "cash" ? cashGiven : total,
        note: note,
        items: cart.map((item) => ({
          product_id: item?.product?.id,
          qty: item?.qty,
          unit_price: getEffectivePrice(item),
        })),
      };

      const res = await postApi("/transactions", payload);
      setLastTxn(res || { invoice_no: "TRX-DONE", total });
      setSuccessModal(true);
    } catch (e: any) {
      showToast(e?.message || "Gagal memproses transaksi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-back" size={20} color={colors.onBrandPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Konfirmasi Pembayaran</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Ringkasan Item */}
        <Text style={styles.sectionTitle}>Ringkasan Pesanan</Text>
        <View style={styles.card}>
          {cart.map((item, idx) => {
            const unitPrice = getEffectivePrice(item);
            return (
              <View key={item?.product?.id || idx} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item?.product?.name}</Text>
                  <Text style={styles.itemSub}>{item?.qty} x {safeRupiah(unitPrice)}</Text>
                </View>
                <Text style={styles.itemTotal}>{safeRupiah(unitPrice * item?.qty)}</Text>
              </View>
            );
          })}
        </View>

        {/* Pelanggan (Opsional) */}
        <Text style={styles.sectionTitle}>Pelanggan (Opsional)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <Pressable
            style={[styles.chip, !selectedCustomerId && styles.chipActive]}
            onPress={() => setSelectedCustomerId("")}
          >
            <Text style={[styles.chipText, !selectedCustomerId && styles.chipTextActive]}>Umum / Eceran</Text>
          </Pressable>
          {customers.map((c) => (
            <Pressable
              key={c.id}
              style={[styles.chip, selectedCustomerId === c.id && styles.chipActive]}
              onPress={() => setSelectedCustomerId(c.id)}
            >
              <Text style={[styles.chipText, selectedCustomerId === c.id && styles.chipTextActive]}>
                {c.name} ({c.tier || "Eceran"})
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Metode Pembayaran */}
        <Text style={styles.sectionTitle}>Metode Pembayaran</Text>
        <View style={styles.methodGrid}>
          {PAYMENT_METHODS.map((m) => {
            const isSelected = paymentMethod === m.id;
            return (
              <Pressable
                key={m.id}
                style={[styles.methodCard, isSelected && styles.methodCardActive]}
                onPress={() => setPaymentMethod(m.id)}
              >
                <Icon name={m.icon as any} size={20} color={isSelected ? colors.brandPrimary : colors.muted} />
                <Text style={[styles.methodLabel, isSelected && styles.methodLabelActive]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Input Uang Cash jika Tunai */}
        {paymentMethod === "cash" && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.inputLabel}>Uang Diterima (Tunai)</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.muted}
              value={cashAmount}
              onChangeText={setCashAmount}
            />
            {cashGiven > 0 && (
              <Text style={{ marginTop: 6, fontSize: 13, fontWeight: "700", color: change >= 0 ? colors.success : colors.error }}>
                Kembalian: {safeRupiah(change)}
              </Text>
            )}
          </View>
        )}

        {/* Diskon & Catatan */}
        <View style={{ marginTop: 12 }}>
          <Text style={styles.inputLabel}>Potongan / Diskon (Rp)</Text>
          <TextInput
            style={styles.textInput}
            keyboardType="numeric"
            value={discountAmount}
            onChangeText={setDiscountAmount}
          />
        </View>

        <View style={{ marginTop: 12 }}>
          <Text style={styles.inputLabel}>Catatan Transaksi</Text>
          <TextInput
            style={[styles.textInput, { height: 60 }]}
            multiline
            placeholder="Catatan tambahan (opsional)..."
            placeholderTextColor={colors.muted}
            value={note}
            onChangeText={setNote}
          />
        </View>
      </ScrollView>

      {/* Footer Total & Bayar */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.footerRow}>
          <Text style={styles.footerTotalLabel}>Total Bayar:</Text>
          <Text style={styles.footerTotalValue}>{safeRupiah(total)}</Text>
        </View>
        <Pressable
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          disabled={submitting}
          onPress={handleCheckout}
        >
          <Text style={styles.submitBtnText}>{submitting ? "Memproses..." : "Selesaikan Transaksi"}</Text>
        </Pressable>
      </View>

      {/* Modal Sukses Transaksi */}
      <Modal visible={successModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Icon name="checkmark-circle" size={60} color={colors.success} style={{ alignSelf: "center" }} />
            <Text style={styles.modalTitle}>Transaksi Berhasil!</Text>
            <Text style={styles.modalSub}>{lastTxn?.invoice_no || "Transaksi tersimpan"}</Text>

            <View style={{ marginVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={{ color: colors.muted }}>Total:</Text>
                <Text style={{ fontWeight: "800", color: colors.onSurface }}>{safeRupiah(total)}</Text>
              </View>
              {paymentMethod === "cash" && (
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.muted }}>Kembalian:</Text>
                  <Text style={{ fontWeight: "800", color: colors.brandPrimary }}>{safeRupiah(change)}</Text>
                </View>
              )}
            </View>

            <Pressable
              style={styles.submitBtn}
              onPress={() => {
                setSuccessModal(false);
                router.replace("/(tabs)/pos");
              }}
            >
              <Text style={styles.submitBtnText}>Kembali ke Kasir</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: c.brand, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  backBtn: { padding: 6, marginRight: 10 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: c.onBrandPrimary },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: c.muted, marginTop: 12, marginBottom: 8 },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: c.border },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  itemName: { fontSize: 13, fontWeight: "700", color: c.onSurface },
  itemSub: { fontSize: 11, color: c.muted },
  itemTotal: { fontSize: 13, fontWeight: "800", color: c.onSurface },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, marginRight: 8 },
  chipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  chipText: { fontSize: 12, color: c.muted, fontWeight: "600" },
  chipTextActive: { color: c.onBrandPrimary },
  methodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  methodCard: { width: "48%", backgroundColor: c.surfaceSecondary, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: c.border, alignItems: "center", flexDirection: "row", gap: 8 },
  methodCardActive: { borderColor: c.brandPrimary, backgroundColor: c.brandTertiary },
  methodLabel: { fontSize: 12, fontWeight: "600", color: c.onSurface },
  methodLabelActive: { color: c.brandPrimary, fontWeight: "800" },
  inputLabel: { fontSize: 12, fontWeight: "700", color: c.onSurface, marginBottom: 4 },
  textInput: { backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 12, height: 42, color: c.onSurface },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: c.surfaceSecondary, borderTopWidth: 1, borderTopColor: c.border, padding: 14 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  footerTotalLabel: { fontSize: 14, fontWeight: "700", color: c.muted },
  footerTotalValue: { fontSize: 18, fontWeight: "800", color: c.brandPrimary },
  submitBtn: { backgroundColor: c.brandPrimary, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  submitBtnText: { color: c.onBrandPrimary, fontSize: 14, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalBox: { width: "100%", backgroundColor: c.surface, borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: c.onSurface, textAlign: "center", marginTop: 10 },
  modalSub: { fontSize: 12, color: c.muted, textAlign: "center", marginTop: 2 },
}));
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
          product_name: item?.product?.name || "Produk",
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
        <Text style={styles.sectionTitle}>Rincian Pesanan</Text>
        {cartItems.map((item, idx) => (
          <View key={idx} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item?.product?.name}</Text>
              <Text style={styles.itemSub}>
                {item?.qty} x {safeRupiah(item?.price)}
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

      {/* Success Modal */}
      <Modal visible={successModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Icon name="checkmark-circle" size={60} color={colors.success || "#16a34a"} />
            <Text style={styles.modalTitle}>Transaksi Berhasil!</Text>
            <Text style={styles.modalSub}>Stok produk otomatis terpotong di MongoDB.</Text>
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
  sectionTitle: { fontSize: 14, fontWeight: "800", color: c.onSurface, marginTop: 16, marginBottom: 8 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  itemName: { fontSize: 14, fontWeight: "700", color: c.onSurface },
  itemSub: { fontSize: 12, color: c.muted },
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