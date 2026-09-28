import { useCallback, useMemo, useState } from "react";
import {
  View, Text, ScrollView, Pressable, Modal, FlatList, Linking,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { api } from "@/src/api";
import { rupiah, CATEGORY_LABELS, TIER_LABELS, PAYMENT_LABELS } from "@/src/format";
import { AppButton, Badge, EmptyState, useToast } from "@/src/ui";

const CATS = [
  { key: "all", label: "Semua" },
  { key: "lpg", label: "Gas LPG" },
  { key: "galon_brand", label: "Air Galon" },
  { key: "refill", label: "Isi Ulang" },
];
const PAYMENTS = ["cash", "transfer", "qris", "tempo", "deposit"];

export default function POS() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [cat, setCat] = useState("all");
  const [cart, setCart] = useState<Record<string, { qty: number; exchange: boolean }>>({});
  const [customer, setCustomer] = useState<any>(null);
  const [tier, setTier] = useState("eceran");
  const [payment, setPayment] = useState("cash");
  const [custModal, setCustModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([api.get("/products"), api.get("/customers")]);
      setProducts(p);
      setCustomers(c);
    } catch (e: any) {
      toast(e.message, "error");
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const priceOf = (p: any) => Number(p[`price_${tier}`] ?? p.price_eceran);
  const filtered = cat === "all" ? products : products.filter((p) => p.category === cat);

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([id, v]) => {
        const p = products.find((x) => x.id === id);
        if (!p || v.qty <= 0) return null;
        return { product: p, qty: v.qty, exchange: v.exchange, subtotal: priceOf(p) * v.qty };
      })
      .filter(Boolean) as any[];
  }, [cart, products, tier]);

  const total = cartItems.reduce((s, i) => s + i.subtotal, 0);
  const totalUnits = cartItems.reduce((s, i) => s + i.qty, 0);

  const setQty = (id: string, delta: number) => {
    setCart((prev) => {
      const cur = prev[id] || { qty: 0, exchange: true };
      const qty = Math.max(0, cur.qty + delta);
      return { ...prev, [id]: { ...cur, qty } };
    });
  };

  const toggleExchange = (id: string) => {
    setCart((prev) => {
      const cur = prev[id] || { qty: 0, exchange: true };
      return { ...prev, [id]: { ...cur, exchange: !cur.exchange } };
    });
  };

  const selectCustomer = (c: any | null) => {
    setCustomer(c);
    setTier(c ? c.tier : "eceran");
    setCustModal(false);
  };

  const shareReceipt = (inv: any) => {
    const lines = [
      "*STRUK GASGALON ERP*",
      `No: ${inv.invoice_no}`,
      `Pelanggan: ${inv.customer_name}`,
      "-------------------------",
      ...inv.items.map((i: any) => `${i.name} x${i.qty} = ${rupiah(i.subtotal)}`),
      "-------------------------",
      `TOTAL: ${rupiah(inv.total)}`,
      `Bayar: ${PAYMENT_LABELS[inv.payment_method]}`,
      inv.status === "outstanding" ? "Status: BELUM LUNAS (Tempo)" : "Status: LUNAS",
      "",
      "Terima kasih 🙏",
    ];
    const text = encodeURIComponent(lines.join("\n"));
    const phone = customer?.phone ? customer.phone.replace(/^0/, "62").replace(/\D/g, "") : "";
    const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    Linking.openURL(url).catch(() => toast("Tidak bisa membuka WhatsApp", "error"));
  };

  const checkout = async () => {
    if (cartItems.length === 0) {
      toast("Keranjang masih kosong", "error");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        customer_id: customer?.id || null,
        tier,
        payment_method: payment,
        channel: customer && customer.type !== "rumahan" ? "b2b" : "pos",
        items: cartItems.map((i) => ({
          product_id: i.product.id,
          name: i.product.name,
          qty: i.qty,
          price: priceOf(i.product),
          is_exchange: i.exchange,
          subtotal: i.subtotal,
        })),
      };
      const inv = await api.post("/transactions", payload);
      toast("Transaksi berhasil!", "success");
      setCart({});
      selectCustomer(null);
      setPayment("cash");
      shareReceipt(inv);
    } catch (e: any) {
      toast(e.message || "Gagal transaksi", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>Kasir POS</Text>
        <Pressable testID="select-customer-button" onPress={() => setCustModal(true)} style={styles.custPill}>
          <Icon name="person-circle-outline" size={18} color={colors.onBrandPrimary} />
          <Text style={styles.custPillText} numberOfLines={1}>
            {customer ? customer.name : "Pelanggan Umum"}
          </Text>
          <Icon name="chevron-down" size={16} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      {/* Category chips */}
      <View style={styles.chipsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
          {CATS.map((ct) => {
            const active = cat === ct.key;
            return (
              <Pressable
                key={ct.key}
                testID={`cat-${ct.key}`}
                onPress={() => setCat(ct.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{ct.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: cartItems.length ? 220 : 32 }}>
        <Text style={styles.tierNote}>Harga: {TIER_LABELS[tier]}</Text>
        {filtered.map((p) => {
          const c = cart[p.id];
          return (
            <View key={p.id} style={styles.prodCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.prodName}>{p.name}</Text>
                <Text style={styles.prodPrice}>{rupiah(priceOf(p))}</Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 6, alignItems: "center" }}>
                  <Badge text={CATEGORY_LABELS[p.category]} bg={colors.surfaceTertiary} fg={colors.onSurfaceTertiary} />
                  <Text style={styles.stockText}>Stok: {p.stock_filled}</Text>
                </View>
                {p.is_returnable && c?.qty > 0 && (
                  <Pressable testID={`exchange-${p.id}`} onPress={() => toggleExchange(p.id)} style={styles.exchangeRow}>
                    <Icon
                      name={c?.exchange ? "checkbox" : "square-outline"}
                      size={18}
                      color={c?.exchange ? colors.brandPrimary : colors.muted}
                    />
                    <Text style={styles.exchangeText}>Tukar tabung/galon kosong</Text>
                  </Pressable>
                )}
              </View>
              <View style={styles.stepper}>
                <Pressable testID={`minus-${p.id}`} onPress={() => setQty(p.id, -1)} style={styles.stepBtn}>
                  <Icon name="remove" size={18} color={colors.onSurface} />
                </Pressable>
                <Text style={styles.qtyText}>{c?.qty || 0}</Text>
                <Pressable testID={`plus-${p.id}`} onPress={() => setQty(p.id, 1)} style={[styles.stepBtn, styles.stepBtnAdd]}>
                  <Icon name="add" size={18} color={colors.onBrandPrimary} />
                </Pressable>
              </View>
            </View>
          );
        })}
        {filtered.length === 0 && <EmptyState icon="cube-outline" title="Belum ada produk" />}
      </ScrollView>

      {/* Sticky checkout bar */}
      {cartItems.length > 0 && (
        <View style={[styles.checkoutBar, { paddingBottom: insets.bottom + 12 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
            {PAYMENTS.map((pm) => {
              const active = payment === pm;
              return (
                <Pressable key={pm} testID={`pay-${pm}`} onPress={() => setPayment(pm)} style={[styles.payChip, active && styles.payChipActive]}>
                  <Text style={[styles.payChipText, active && styles.payChipTextActive]}>{PAYMENT_LABELS[pm]}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.checkoutRow}>
            <View>
              <Text style={styles.totalLabel}>{totalUnits} item</Text>
              <Text testID="cart-total" style={styles.totalValue}>{rupiah(total)}</Text>
            </View>
            <AppButton
              title="Bayar Sekarang"
              onPress={checkout}
              loading={submitting}
              icon="cash-outline"
              testID="checkout-button"
              style={{ flex: 1, marginLeft: 14 }}
            />
          </View>
        </View>
      )}

      {/* Customer modal */}
      <Modal visible={custModal} animationType="slide" transparent onRequestClose={() => setCustModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCustModal(false)} />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.modalTitle}>Pilih Pelanggan</Text>
          <Pressable testID="customer-umum" onPress={() => selectCustomer(null)} style={styles.custRow}>
            <Icon name="walk-outline" size={20} color={colors.onSurface} />
            <Text style={styles.custRowText}>Pelanggan Umum (Eceran)</Text>
          </Pressable>
          <FlatList
            data={customers}
            keyExtractor={(i) => i.id}
            style={{ maxHeight: 380 }}
            renderItem={({ item }) => (
              <Pressable testID={`customer-${item.id}`} onPress={() => selectCustomer(item)} style={styles.custRow}>
                <Icon name="business-outline" size={20} color={colors.brandPrimary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.custRowText}>{item.name}</Text>
                  <Text style={styles.custRowSub}>{TIER_LABELS[item.tier]} • Deposit {rupiah(item.deposit_balance)} • Piutang {rupiah(item.receivable_balance)}</Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 14, backgroundColor: c.brand, gap: 12,
    borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
  },
  title: { color: c.onBrandPrimary, fontSize: 20, fontWeight: "800" },
  custPill: {
    flexDirection: "row", alignItems: "center", gap: 6, maxWidth: 180,
    backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
  },
  custPillText: { color: c.onBrandPrimary, fontWeight: "600", fontSize: 13, flexShrink: 1 },
  chipsWrap: { height: 56, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.surfaceSecondary },
  chipsContent: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  chip: { height: 36, paddingHorizontal: 16, borderRadius: 999, backgroundColor: c.surfaceTertiary, justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: c.brandPrimary },
  chipText: { color: c.onSurfaceTertiary, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: c.onBrandPrimary },
  tierNote: { color: c.muted, fontSize: 12, marginBottom: 12, fontWeight: "600" },
  prodCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: c.surfaceSecondary,
    borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: c.border, gap: 10,
  },
  prodName: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  prodPrice: { fontSize: 15, fontWeight: "800", color: c.brandPrimary, marginTop: 2 },
  stockText: { fontSize: 11, color: c.muted },
  exchangeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  exchangeText: { fontSize: 12, color: c.onSurfaceSecondary },
  stepper: { alignItems: "center", gap: 6 },
  stepBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  stepBtnAdd: { backgroundColor: c.brandPrimary },
  qtyText: { fontSize: 16, fontWeight: "800", color: c.onSurface, minWidth: 28, textAlign: "center" },
  checkoutBar: {
    position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: c.surfaceSecondary,
    borderTopWidth: 1, borderTopColor: c.border, paddingHorizontal: 16, paddingTop: 12,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  payChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: c.surfaceTertiary, flexShrink: 0 },
  payChipActive: { backgroundColor: c.brandPrimary },
  payChipText: { color: c.onSurfaceTertiary, fontWeight: "600", fontSize: 12 },
  payChipTextActive: { color: c.onBrandPrimary },
  checkoutRow: { flexDirection: "row", alignItems: "center" },
  totalLabel: { fontSize: 11, color: c.muted },
  totalValue: { fontSize: 20, fontWeight: "800", color: c.onSurface },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: { backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: c.onSurface, marginBottom: 14 },
  custRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.divider },
  custRowText: { fontSize: 15, fontWeight: "600", color: c.onSurface },
  custRowSub: { fontSize: 11, color: c.muted, marginTop: 2 },
}));
