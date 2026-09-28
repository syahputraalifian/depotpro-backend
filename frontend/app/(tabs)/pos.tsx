import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Modal, FlatList } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { api } from "@/src/api";
import { rupiah, CATEGORY_LABELS, TIER_LABELS, PAYMENT_LABELS } from "@/src/format";
import { AppButton, Badge, EmptyState, useToast } from "@/src/ui";
import { printReceipt, sendWhatsApp } from "@/src/receipt";

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
  const [drivers, setDrivers] = useState<any[]>([]);
  const [cat, setCat] = useState("all");
  const [cart, setCart] = useState<Record<string, { qty: number; exchange: boolean }>>({});
  const [customer, setCustomer] = useState<any>(null);
  const [tier, setTier] = useState("eceran");
  const [payment, setPayment] = useState("cash");
  const [channel, setChannel] = useState<"pos" | "delivery">("pos");
  const [selDriver, setSelDriver] = useState<any>(null);
  const [custModal, setCustModal] = useState(false);
  const [driverModal, setDriverModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [defaultReceipt, setDefaultReceipt] = useState("whatsapp");
  const [receiptInv, setReceiptInv] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const [p, c, d, s] = await Promise.all([
        api.get("/products"), api.get("/customers"), api.get("/users/drivers"), api.get("/settings"),
      ]);
      setProducts(p);
      setCustomers(c);
      setDrivers(d);
      setDefaultReceipt(s.default_receipt_option || "whatsapp");
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

  const setQty = (id: string, delta: number) =>
    setCart((prev) => {
      const cur = prev[id] || { qty: 0, exchange: true };
      return { ...prev, [id]: { ...cur, qty: Math.max(0, cur.qty + delta) } };
    });

  const toggleExchange = (id: string) =>
    setCart((prev) => {
      const cur = prev[id] || { qty: 0, exchange: true };
      return { ...prev, [id]: { ...cur, exchange: !cur.exchange } };
    });

  const selectCustomer = (c: any | null) => {
    setCustomer(c);
    setTier(c ? c.tier : "eceran");
    setCustModal(false);
  };

  const runReceipt = async (option: string, inv: any) => {
    try {
      if (option === "print") await printReceipt(inv);
      else if (option === "whatsapp") await sendWhatsApp(inv, customer?.phone);
    } catch {
      toast("Gagal menyiapkan struk", "error");
    }
  };

  const checkout = async () => {
    if (cartItems.length === 0) { toast("Keranjang masih kosong", "error"); return; }
    if (channel === "delivery" && !selDriver) { toast("Pilih kurir pengantar", "error"); return; }
    setSubmitting(true);
    try {
      const payload = {
        customer_id: customer?.id || null,
        tier,
        payment_method: payment,
        channel: channel === "delivery" ? "delivery" : (customer && customer.type !== "rumahan" ? "b2b" : "pos"),
        driver_id: channel === "delivery" ? selDriver?.id : null,
        items: cartItems.map((i) => ({
          product_id: i.product.id, name: i.product.name, qty: i.qty,
          price: priceOf(i.product), is_exchange: i.exchange, subtotal: i.subtotal,
        })),
      };
      const inv = await api.post("/transactions", payload);
      toast("Transaksi berhasil!", "success");
      setCart({});
      const c = customer;
      selectCustomer(null);
      setPayment("cash");
      setChannel("pos");
      setSelDriver(null);
      // real-time state: re-fetch products so stock/terjual update instantly (no manual refresh)
      load();
      // receipt: run default if not skip, else always show options modal for choice
      setReceiptInv({ ...inv, _phone: c?.phone });
      if (defaultReceipt === "print") runReceipt("print", inv);
      else if (defaultReceipt === "whatsapp") runReceipt("whatsapp", inv);
    } catch (e: any) {
      toast(e.message || "Gagal transaksi", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>Kasir POS</Text>
        <Pressable testID="select-customer-button" onPress={() => setCustModal(true)} style={styles.custPill}>
          <Icon name="person-circle-outline" size={18} color={colors.onBrandPrimary} />
          <Text style={styles.custPillText} numberOfLines={1}>{customer ? customer.name : "Pelanggan Umum"}</Text>
          <Icon name="chevron-down" size={16} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      {/* Category chips */}
      <View style={styles.chipsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
          {CATS.map((ct) => {
            const active = cat === ct.key;
            return (
              <Pressable key={ct.key} testID={`cat-${ct.key}`} onPress={() => setCat(ct.key)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{ct.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: cartItems.length ? 300 : 32 }}>
        <View style={styles.channelRow}>
          <Text style={styles.tierNote}>Harga: {TIER_LABELS[tier]}</Text>
          <View style={styles.channelToggle}>
            <Pressable testID="channel-pos" onPress={() => setChannel("pos")} style={[styles.chSeg, channel === "pos" && styles.chSegActive]}>
              <Text style={[styles.chSegText, channel === "pos" && styles.chSegTextActive]}>Di Toko</Text>
            </Pressable>
            <Pressable testID="channel-delivery" onPress={() => setChannel("delivery")} style={[styles.chSeg, channel === "delivery" && styles.chSegActive]}>
              <Text style={[styles.chSegText, channel === "delivery" && styles.chSegTextActive]}>Antar</Text>
            </Pressable>
          </View>
        </View>

        {channel === "delivery" && (
          <Pressable testID="select-driver-button" onPress={() => setDriverModal(true)} style={styles.driverPick}>
            <Icon name="car-outline" size={18} color={colors.brandPrimary} />
            <Text style={styles.driverPickText}>{selDriver ? `Kurir: ${selDriver.name}` : "Pilih Kurir Pengantar"}</Text>
            <Icon name="chevron-down" size={16} color={colors.muted} />
          </Pressable>
        )}

        {filtered.map((p) => {
          const c = cart[p.id];
          return (
            <View key={p.id} style={styles.prodCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.prodName}>{p.name}</Text>
                <Text style={styles.prodPrice}>{rupiah(priceOf(p))}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6, alignItems: "center" }}>
                  <Badge text={CATEGORY_LABELS[p.category]} bg={colors.surfaceTertiary} fg={colors.onSurfaceTertiary} />
                  <Text style={[styles.stockText, { color: p.stock_filled > p.reorder_point ? colors.success : colors.error }]}>
                    Tersisa: {p.stock_filled}
                  </Text>
                  <Text style={styles.soldText}>| Terjual: {p.total_sold || 0}</Text>
                  {p.category !== "refill" && (
                    <Text style={styles.emptyText}>| Wadah Kosong: {p.stock_empty}</Text>
                  )}
                </View>
                {p.is_returnable && c?.qty > 0 && (
                  <Pressable testID={`exchange-${p.id}`} onPress={() => toggleExchange(p.id)} style={styles.exchangeRow}>
                    <Icon name={c?.exchange ? "checkbox" : "square-outline"} size={18} color={c?.exchange ? colors.brandPrimary : colors.muted} />
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
            <AppButton title="Bayar Sekarang" onPress={checkout} loading={submitting} icon="cash-outline" testID="checkout-button" style={{ flex: 1, marginLeft: 14 }} />
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

      {/* Driver modal */}
      <Modal visible={driverModal} animationType="slide" transparent onRequestClose={() => setDriverModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDriverModal(false)} />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.modalTitle}>Pilih Kurir Pengantar</Text>
          {drivers.length === 0 ? (
            <Text style={styles.custRowSub}>Belum ada kurir. Tambahkan di menu Kelola Kurir.</Text>
          ) : drivers.map((d) => (
            <Pressable key={d.id} testID={`pick-driver-${d.id}`} onPress={() => { setSelDriver(d); setDriverModal(false); }} style={styles.custRow}>
              <Icon name="car-outline" size={20} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.custRowText}>{d.name}</Text>
                <Text style={styles.custRowSub}>{[d.vehicle_type, d.plate_number, d.phone].filter(Boolean).join(" • ") || "Tanpa data kendaraan"}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Modal>

      {/* Receipt options modal */}
      <Modal visible={!!receiptInv} animationType="fade" transparent onRequestClose={() => setReceiptInv(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setReceiptInv(null)} />
        <View style={[styles.receiptSheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.successIcon}><Icon name="checkmark-circle" size={40} color={colors.success} /></View>
          <Text style={styles.receiptTitle}>Transaksi Berhasil</Text>
          <Text style={styles.receiptSub}>{receiptInv?.invoice_no} • {rupiah(receiptInv?.total)}</Text>
          <AppButton title="Cetak Struk & Selesai" icon="print-outline" testID="receipt-print" onPress={() => { runReceipt("print", receiptInv); setReceiptInv(null); }} style={{ marginTop: 8 }} />
          <AppButton title="Kirim Struk WhatsApp" icon="logo-whatsapp" variant="secondary" testID="receipt-wa" onPress={() => { sendWhatsApp(receiptInv, receiptInv?._phone); setReceiptInv(null); }} style={{ marginTop: 10 }} />
          <AppButton title="Selesai Tanpa Struk" icon="close-circle-outline" variant="outline" testID="receipt-skip" onPress={() => setReceiptInv(null)} style={{ marginTop: 10 }} />
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, backgroundColor: c.brand, gap: 12, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
  title: { color: c.onBrandPrimary, fontSize: 20, fontWeight: "800" },
  custPill: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: 180, backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  custPillText: { color: c.onBrandPrimary, fontWeight: "600", fontSize: 13, flexShrink: 1 },
  chipsWrap: { height: 56, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.surfaceSecondary },
  chipsContent: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  chip: { height: 36, paddingHorizontal: 16, borderRadius: 999, backgroundColor: c.surfaceTertiary, justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: c.brandPrimary },
  chipText: { color: c.onSurfaceTertiary, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: c.onBrandPrimary },
  channelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  tierNote: { color: c.muted, fontSize: 12, fontWeight: "600" },
  channelToggle: { flexDirection: "row", backgroundColor: c.surfaceTertiary, borderRadius: 999, padding: 3 },
  chSeg: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  chSegActive: { backgroundColor: c.brandPrimary },
  chSegText: { fontSize: 12, fontWeight: "700", color: c.onSurfaceTertiary },
  chSegTextActive: { color: c.onBrandPrimary },
  driverPick: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 14, marginBottom: 14 },
  driverPickText: { flex: 1, fontSize: 14, fontWeight: "600", color: c.onSurface },
  prodCard: { flexDirection: "row", alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: c.border, gap: 10 },
  prodName: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  prodPrice: { fontSize: 15, fontWeight: "800", color: c.brandPrimary, marginTop: 2 },
  stockText: { fontSize: 11, fontWeight: "700" },
  soldText: { fontSize: 11, color: c.muted, fontWeight: "600" },
  emptyText: { fontSize: 11, color: c.assetGallon, fontWeight: "600" },
  exchangeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  exchangeText: { fontSize: 12, color: c.onSurfaceSecondary },
  stepper: { alignItems: "center", gap: 6 },
  stepBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  stepBtnAdd: { backgroundColor: c.brandPrimary },
  qtyText: { fontSize: 16, fontWeight: "800", color: c.onSurface, minWidth: 28, textAlign: "center" },
  checkoutBar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: c.surfaceSecondary, borderTopWidth: 1, borderTopColor: c.border, paddingHorizontal: 16, paddingTop: 12, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
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
  receiptSheet: { position: "absolute", left: 20, right: 20, top: "28%", backgroundColor: c.surface, borderRadius: 22, padding: 24, alignItems: "stretch" },
  successIcon: { alignSelf: "center", marginBottom: 8 },
  receiptTitle: { fontSize: 18, fontWeight: "800", color: c.onSurface, textAlign: "center" },
  receiptSub: { fontSize: 13, color: c.muted, textAlign: "center", marginTop: 4, marginBottom: 8 },
}));
