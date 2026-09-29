import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, Modal, RefreshControl, TextInput } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import * as themeModule from "@/src/theme";
import * as authModule from "@/src/auth/AuthContext";
import * as apiModule from "@/src/api";
import * as formatModule from "@/src/format";
import * as uiModule from "@/src/ui";

const TYPES = [
  { key: "rumahan", tier: "eceran" },
  { key: "warung", tier: "warung" },
  { key: "pangkalan", tier: "pangkalan" },
  { key: "korporat", tier: "korporat" },
];
const PAY_METHODS = ["cash", "transfer", "qris"];

// Helper aman untuk format Rupiah
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

// Helper aman untuk TIER_LABELS
const getTierLabel = (tier: string) => {
  const labels = (formatModule as any)?.TIER_LABELS || {};
  return labels[tier] || tier || "Umum";
};

// Helper aman untuk PAYMENT_LABELS
const getPaymentLabel = (method: string) => {
  const labels = (formatModule as any)?.PAYMENT_LABELS || {};
  return labels[method] || method || "-";
};

// Helper aman untuk shortDate
const safeShortDate = (dateStr: any) => {
  const fn = (formatModule as any)?.shortDate;
  if (typeof fn === "function") {
    try {
      return fn(dateStr);
    } catch {
      return String(dateStr || "");
    }
  }
  return String(dateStr || "");
};

// Helper aman untuk timeAgo
const safeTimeAgo = (dateStr: any) => {
  const fn = (formatModule as any)?.timeAgo;
  if (typeof fn === "function") {
    try {
      return fn(dateStr);
    } catch {
      return String(dateStr || "");
    }
  }
  return String(dateStr || "");
};

export default function Pelanggan() {
  const theme = typeof (themeModule as any)?.useTheme === "function" ? (themeModule as any).useTheme() : { colors: {} };
  const colors = theme?.colors || {};
  const styles: any = typeof useStyles === "function" ? useStyles() : {};
  const insets = useSafeAreaInsets();

  const authContext = typeof (authModule as any)?.useAuth === "function" ? (authModule as any).useAuth() : null;
  const user = authContext?.user;
  const isOwner = user?.role === "owner";

  const showToast = useCallback((msg: string, type?: string) => {
    try {
      const useToastHook = (uiModule as any)?.useToast;
      if (typeof useToastHook === "function") {
        const toast = useToastHook();
        if (typeof toast === "function") {
          toast(msg, type);
          return;
        } else if (toast && typeof toast.show === "function") {
          toast.show(msg, type);
          return;
        }
      }
    } catch (e) {}
    console.log(`[Toast ${type || "info"}]:`, msg);
  }, []);

  const [customers, setCustomers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [detailTxns, setDetailTxns] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [tab, setTab] = useState<"txn" | "ledger">("txn");
  const [topup, setTopup] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    name: "", type: "warung", phone: "", address: "", credit_limit: "", payment_terms_days: "7", deposit_balance: "",
  });

  const [payTxn, setPayTxn] = useState<any>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNote, setPayNote] = useState("");

  const [adjModal, setAdjModal] = useState(false);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [depModal, setDepModal] = useState(false);
  const [depAmount, setDepAmount] = useState("");
  const [depReason, setDepReason] = useState("");

  const getApi = (apiModule as any)?.api || (apiModule as any)?.default;

  const load = useCallback(async () => {
    try {
      if (getApi && typeof getApi.get === "function") {
        const res = await getApi.get("/customers");
        setCustomers(Array.isArray(res) ? res : []);
      }
    } catch (e: any) {
      showToast(e?.message || "Gagal memuat data pelanggan", "error");
    }
  }, [getApi, showToast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  const refreshDetail = async (cid: string) => {
    if (!cid || !getApi || typeof getApi.get !== "function") return;
    const res = await getApi.get("/customers");
    const safeCust = Array.isArray(res) ? res : [];
    const fresh = safeCust.find((x: any) => x?.id === cid);
    setDetail(fresh || null);
    setCustomers(safeCust);

    const [t, l] = await Promise.all([
      getApi.get(`/customers/${cid}/transactions`).catch(() => []),
      getApi.get(`/customers/${cid}/receivable-history`).catch(() => []),
    ]);
    setDetailTxns(Array.isArray(t) ? t : []);
    setLedger(Array.isArray(l) ? l : []);
  };

  const openDetail = async (c: any) => {
    if (!c) return;
    setDetail(c);
    setTab("txn");
    try { await refreshDetail(c.id); } catch { setDetailTxns([]); setLedger([]); }
  };

  const saveCustomer = async () => {
    if (!form?.name) { showToast("Nama wajib diisi", "error"); return; }
    setSaving(true);
    try {
      const tier = TYPES.find((t) => t.key === form.type)?.tier || "eceran";
      if (getApi && typeof getApi.post === "function") {
        await getApi.post("/customers", {
          name: form.name, type: form.type, tier, phone: form.phone, address: form.address,
          credit_limit: Number(form.credit_limit || 0), payment_terms_days: Number(form.payment_terms_days || 7),
          deposit_balance: Number(form.deposit_balance || 0),
        });
      }
      showToast("Pelanggan ditambahkan", "success");
      setAddModal(false);
      setForm({ name: "", type: "warung", phone: "", address: "", credit_limit: "", payment_terms_days: "7", deposit_balance: "" });
      load();
    } catch (e: any) {
      showToast(e?.message || "Gagal menyimpan pelanggan", "error");
    } finally {
      setSaving(false);
    }
  };

  const doTopup = async () => {
    const amt = Number(topup || 0);
    if (amt <= 0) { showToast("Masukkan nominal", "error"); return; }
    if (!detail?.id) return;
    try {
      if (getApi && typeof getApi.post === "function") {
        await getApi.post(`/customers/${detail.id}/deposit`, { amount: amt });
      }
      showToast("Deposit ditambahkan", "success");
      setTopup("");
      await refreshDetail(detail.id);
    } catch (e: any) {
      showToast(e?.message || "Gagal menambah deposit", "error");
    }
  };

  const submitDepAdjust = async () => {
    const amt = Number(depAmount || 0);
    if (amt >= 0 || !depReason) { showToast("Isi nominal pengurangan (negatif) & alasan", "error"); return; }
    if (!detail?.id) return;
    try {
      if (getApi && typeof getApi.post === "function") {
        await getApi.post(`/customers/${detail.id}/deposit`, { amount: amt, reason: depReason });
      }
      showToast("Deposit dikoreksi", "success");
      setDepModal(false); setDepAmount(""); setDepReason("");
      await refreshDetail(detail.id);
    } catch (e: any) {
      showToast(e?.message || "Gagal mengoreksi deposit", "error");
    }
  };

  const openPay = (t: any) => {
    if (!t) return;
    setPayTxn(t);
    setPayAmount(String(Math.round((t.total || 0) - (t.amount_paid || 0))));
    setPayMethod("cash");
    setPayNote("");
  };

  const submitPay = async () => {
    if (!payTxn?.id) return;
    try {
      if (getApi && typeof getApi.post === "function") {
        const res = await getApi.post(`/transactions/${payTxn.id}/pay`, {
          amount: Number(payAmount || 0), method: payMethod, note: payNote,
        });
        showToast(res?.fully_paid ? "Piutang lunas!" : `Cicilan diterima, sisa ${safeRupiah(res?.remaining)}`, "success");
      }
      setPayTxn(null);
      if (detail?.id) await refreshDetail(detail.id);
    } catch (e: any) {
      showToast(e?.message || "Gagal memproses pembayaran", "error");
    }
  };

  const submitAdjust = async () => {
    const amt = Number(adjAmount || 0);
    if (amt === 0 || !adjReason) { showToast("Isi nominal (+/-) dan alasan", "error"); return; }
    if (!detail?.id) return;
    try {
      if (getApi && typeof getApi.post === "function") {
        await getApi.post(`/customers/${detail.id}/adjust-receivable`, { amount: amt, reason: adjReason });
      }
      showToast("Piutang disesuaikan", "success");
      setAdjModal(false); setAdjAmount(""); setAdjReason("");
      await refreshDetail(detail.id);
    } catch (e: any) {
      showToast(e?.message || "Gagal menyesuaikan piutang", "error");
    }
  };

  const safeCustomers = Array.isArray(customers) ? customers : [];
  const safeDetailTxns = Array.isArray(detailTxns) ? detailTxns : [];
  const safeLedger = Array.isArray(ledger) ? ledger : [];

  const CustomBadge = ({ text, bg, fg }: any) => (
    <View style={{ backgroundColor: bg || colors.brandTertiary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
      <Text style={{ color: fg || colors.onBrandTertiary, fontSize: 10, fontWeight: "700" }}>{text}</Text>
    </View>
  );

  const CustomField = ({ label, value, onChangeText, placeholder, keyboardType, testID }: any) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted || "#888"}
        keyboardType={keyboardType}
        style={{ height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border || "#ccc", paddingHorizontal: 12, color: colors.onSurface || "#000", backgroundColor: colors.surfaceSecondary || "#fff" }}
      />
    </View>
  );

  const CustomButton = ({ title, onPress, style }: any) => (
    <Pressable onPress={onPress} style={[{ backgroundColor: colors.brandPrimary || "#007AFF", paddingVertical: 12, borderRadius: 10, alignItems: "center" }, style]}>
      <Text style={{ color: colors.onBrandPrimary || "#fff", fontSize: 14, fontWeight: "700" }}>{title}</Text>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Pelanggan & Piutang</Text>
        <Pressable testID="add-customer-button" onPress={() => setAddModal(true)} style={styles.addBtn}>
          <Icon name="add" size={22} color={colors.onBrandPrimary || "#fff"} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        {safeCustomers.map((c) => (
          <Pressable key={c?.id || Math.random().toString()} testID={`customer-card-${c?.id}`} onPress={() => openDetail(c)} style={styles.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c?.name || "Pelanggan"}</Text>
                <Text style={styles.phone}>{c?.phone || "Tanpa nomor"}</Text>
              </View>
              <CustomBadge text={getTierLabel(c?.tier)} bg={colors.brandTertiary} fg={colors.onBrandTertiary} />
            </View>
            <View style={styles.row}>
              <View style={styles.metric}>
                <Text style={styles.mLabel}>Deposit</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.mVal, { color: colors.success }]}>
                  {safeRupiah(c?.deposit_balance)}
                </Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.mLabel}>Piutang</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.mVal, { color: (c?.receivable_balance || 0) > 0 ? colors.error : colors.muted }]}>
                  {safeRupiah(c?.receivable_balance)}
                </Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.mLabel}>Plafon</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={styles.mVal}>
                  {safeRupiah(c?.credit_limit)}
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
        {safeCustomers.length === 0 && (
          <View style={{ padding: 30, alignItems: "center" }}>
            <Text style={{ color: colors.muted || "#888", fontSize: 14 }}>Belum ada pelanggan</Text>
          </View>
        )}
      </ScrollView>

      {/* Add modal */}
      <Modal visible={addModal} animationType="slide" transparent onRequestClose={() => setAddModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAddModal(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, maxHeight: "88%" }]}>
          <Text style={styles.sheetTitle}>Tambah Pelanggan</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <CustomField label="Nama" value={form.name} onChangeText={(v: string) => set("name", v)} placeholder="Pangkalan Jaya" testID="cf-name" />
            <Text style={styles.fieldLabel}>Tipe / Tingkat Harga</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {TYPES.map((t) => (
                <Pressable
                  key={t.key}
                  testID={`cf-type-${t.key}`}
                  onPress={() => set("type", t.key)}
                  style={[styles.typeBtn, form.type === t.key && styles.typeBtnActive]}
                >
                  <Text style={[styles.typeText, form.type === t.key && styles.typeTextActive]}>{getTierLabel(t.tier)}</Text>
                </Pressable>
              ))}
            </View>
            <CustomField label="No. WhatsApp" value={form.phone} onChangeText={(v: string) => set("phone", v)} keyboardType="phone-pad" placeholder="08123456789" />
            <CustomField label="Alamat" value={form.address} onChangeText={(v: string) => set("address", v)} placeholder="Jl. ..." />
            <CustomField label="Plafon Kredit (Tempo)" value={form.credit_limit} onChangeText={(v: string) => set("credit_limit", v)} keyboardType="numeric" placeholder="5000000" />
            <CustomField label="Termin Pembayaran (hari)" value={form.payment_terms_days} onChangeText={(v: string) => set("payment_terms_days", v)} keyboardType="numeric" placeholder="7" />
            <CustomField label="Saldo Deposit Awal" value={form.deposit_balance} onChangeText={(v: string) => set("deposit_balance", v)} keyboardType="numeric" placeholder="0" />
            <CustomButton title={saving ? "Menyimpan..." : "Simpan"} onPress={saveCustomer} />
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Detail modal */}
      <Modal visible={!!detail} animationType="slide" transparent onRequestClose={() => setDetail(null)}>
        <Pressable style={styles.backdrop} onPress={() => setDetail(null)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, maxHeight: "90%" }]}>
          <Text style={styles.sheetTitle}>{detail?.name}</Text>
          <Text style={styles.sheetSub}>
            {detail && getTierLabel(detail.tier)} • {detail?.phone}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.detailRow}>
              <View style={styles.detailBox}>
                <Text style={styles.mLabel}>Deposit</Text>
                <Text style={[styles.mVal, { color: colors.success }]}>{safeRupiah(detail?.deposit_balance)}</Text>
              </View>
              <View style={styles.detailBox}>
                <Text style={styles.mLabel}>Piutang</Text>
                <Text style={[styles.mVal, { color: colors.error }]}>{safeRupiah(detail?.receivable_balance)}</Text>
              </View>
            </View>
            <CustomField label="Top-up Deposit" value={topup} onChangeText={setTopup} keyboardType="numeric" placeholder="Nominal" testID="topup-input" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <CustomButton title="Tambah Deposit" onPress={doTopup} style={{ flex: 1 }} />
              {isOwner && (
                <CustomButton title="Kurangi Deposit" onPress={() => setDepModal(true)} style={{ flex: 1, backgroundColor: "#6B7280" }} />
              )}
            </View>
            {isOwner && (
              <CustomButton title="Koreksi Piutang" onPress={() => setAdjModal(true)} style={{ marginTop: 10, backgroundColor: "#6B7280" }} />
            )}

            <View style={styles.tabRow}>
              <Pressable testID="tab-txn" onPress={() => setTab("txn")} style={[styles.tabBtn, tab === "txn" && styles.tabBtnActive]}>
                <Text style={[styles.tabText, tab === "txn" && styles.tabTextActive]}>Transaksi</Text>
              </Pressable>
              <Pressable testID="tab-ledger" onPress={() => setTab("ledger")} style={[styles.tabBtn, tab === "ledger" && styles.tabBtnActive]}>
                <Text style={[styles.tabText, tab === "ledger" && styles.tabTextActive]}>Mutasi Piutang</Text>
              </Pressable>
            </View>

            {tab === "txn" ? (
              safeDetailTxns.length === 0 ? (
                <Text style={styles.sheetSub}>Belum ada transaksi</Text>
              ) : (
                safeDetailTxns.map((t) => (
                  <View key={t?.id || Math.random().toString()} style={styles.txnRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txnName}>{t?.invoice_no || "Transaksi"}</Text>
                      <Text style={styles.txnMeta}>
                        {getPaymentLabel(t?.payment_method)} • {safeShortDate(t?.created_at)}
                        {(t?.amount_paid || 0) > 0 && t?.status === "outstanding" ? ` • dibayar ${safeRupiah(t?.amount_paid)}` : ""}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={styles.txnAmt}>{safeRupiah(t?.total)}</Text>
                      {t?.status === "outstanding" ? (
                        <Pressable testID={`pay-${t?.id}`} onPress={() => openPay(t)} style={styles.settleBtn}>
                          <Text style={styles.settleText}>Bayar</Text>
                        </Pressable>
                      ) : (
                        <CustomBadge text="Lunas" bg={colors.brandTertiary} fg={colors.onBrandTertiary} />
                      )}
                    </View>
                  </View>
                ))
              )
            ) : safeLedger.length === 0 ? (
              <Text style={styles.sheetSub}>Belum ada mutasi piutang</Text>
            ) : (
              safeLedger.map((l) => (
                <View key={l?.id || Math.random().toString()} style={styles.ledRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txnName}>{l?.type === "charge" ? "Piutang Baru" : l?.type === "payment" ? "Pembayaran" : "Penyesuaian"}</Text>
                    <Text style={styles.txnMeta}>
                      {l?.note || "-"} • {safeTimeAgo(l?.created_at)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.txnAmt, { color: (l?.amount || 0) >= 0 ? colors.error : colors.success }]}>
                      {(l?.amount || 0) >= 0 ? "+" : ""}
                      {safeRupiah(l?.amount)}
                    </Text>
                    <Text style={styles.txnMeta}>Saldo {safeRupiah(l?.balance_after)}</Text>
                  </View>
                </View>
              ))
            )}
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Payment modal */}
      <Modal visible={!!payTxn} animationType="slide" transparent onRequestClose={() => setPayTxn(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPayTxn(null)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.sheetTitle}>Terima Pembayaran</Text>
          <Text style={styles.sheetSub}>
            {payTxn?.invoice_no} • Sisa {safeRupiah((payTxn?.total || 0) - (payTxn?.amount_paid || 0))}
          </Text>
          <CustomField label="Nominal Dibayar (bisa parsial/cicilan)" value={payAmount} onChangeText={setPayAmount} keyboardType="numeric" testID="pay-amount-input" />
          <Text style={styles.fieldLabel}>Metode Bayar</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
            {PAY_METHODS.map((m) => (
              <Pressable
                key={m}
                testID={`pm-${m}`}
                onPress={() => setPayMethod(m)}
                style={[styles.typeBtn, payMethod === m && styles.typeBtnActive]}
              >
                <Text style={[styles.typeText, payMethod === m && styles.typeTextActive]}>{getPaymentLabel(m)}</Text>
              </Pressable>
            ))}
          </View>
          <CustomField label="Catatan (opsional)" value={payNote} onChangeText={setPayNote} placeholder="cicilan minggu 1" />
          <CustomButton title="Simpan Pembayaran" onPress={submitPay} />
        </View>
      </Modal>

      {/* Adjust receivable modal */}
      <Modal visible={adjModal} animationType="slide" transparent onRequestClose={() => setAdjModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAdjModal(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.sheetTitle}>Koreksi / Penyesuaian Piutang</Text>
          <Text style={styles.sheetSub}>Gunakan angka positif untuk menambah, negatif untuk mengurangi saldo piutang.</Text>
          <CustomField label="Nominal Penyesuaian (+/-)" value={adjAmount} onChangeText={setAdjAmount} keyboardType="numbers-and-punctuation" placeholder="-50000" testID="adj-amount-input" />
          <CustomField label="Alasan / Catatan" value={adjReason} onChangeText={setAdjReason} placeholder="Koreksi salah input" testID="adj-reason-input" />
          <CustomButton title="Simpan Penyesuaian" onPress={submitAdjust} />
        </View>
      </Modal>

      {/* Reduce / correct deposit modal */}
      <Modal visible={depModal} animationType="slide" transparent onRequestClose={() => setDepModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setDepModal(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.sheetTitle}>Kurangi / Koreksi Deposit</Text>
          <Text style={styles.sheetSub}>
            Saldo saat ini {safeRupiah(detail?.deposit_balance)}. Masukkan nominal negatif untuk mengurangi (mis. pengembalian tunai / koreksi input).
          </Text>
          <CustomField label="Nominal Pengurangan (negatif)" value={depAmount} onChangeText={setDepAmount} keyboardType="numbers-and-punctuation" placeholder="-50000" testID="dep-amount-input" />
          <CustomField label="Alasan / Catatan Koreksi" value={depReason} onChangeText={setDepReason} placeholder="Pengembalian tunai ke pelanggan" testID="dep-reason-input" />
          <CustomButton title="Simpan Koreksi Deposit" onPress={submitDepAdjust} />
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
      card: { backgroundColor: c.surfaceSecondary, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: c.border },
      name: { fontSize: 15, fontWeight: "700", color: c.onSurface },
      phone: { fontSize: 12, color: c.muted, marginTop: 2 },
      row: { flexDirection: "row", marginTop: 14, gap: 8 },
      metric: { flex: 1, backgroundColor: c.surfaceTertiary, borderRadius: 10, padding: 10 },
      mLabel: { fontSize: 10, color: c.muted },
      mVal: { fontSize: 14, fontWeight: "800", color: c.onSurface, marginTop: 2 },
      backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
      sheet: { backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20 },
      sheetTitle: { fontSize: 18, fontWeight: "800", color: c.onSurface, marginBottom: 2 },
      sheetSub: { fontSize: 13, color: c.muted, marginBottom: 14 },
      fieldLabel: { color: c.onSurfaceSecondary, fontSize: 13, fontWeight: "600", marginBottom: 6 },
      typeBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: c.surfaceTertiary },
      typeBtnActive: { backgroundColor: c.brandPrimary },
      typeText: { fontSize: 12, fontWeight: "600", color: c.onSurfaceTertiary },
      typeTextActive: { color: c.onBrandPrimary },
      detailRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
      detailBox: { flex: 1, backgroundColor: c.surfaceTertiary, borderRadius: 12, padding: 14 },
      tabRow: { flexDirection: "row", gap: 8, marginTop: 20, marginBottom: 8 },
      tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: c.surfaceTertiary, alignItems: "center" },
      tabBtnActive: { backgroundColor: c.brandPrimary },
      tabText: { fontSize: 13, fontWeight: "700", color: c.onSurfaceTertiary },
      tabTextActive: { color: c.onBrandPrimary },
      txnRow: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: c.divider, paddingBottom: 12 },
      ledRow: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: c.divider, paddingBottom: 12 },
      txnName: { color: c.onSurface, fontSize: 14, fontWeight: "700" },
      txnMeta: { color: c.muted, fontSize: 11, marginTop: 2 },
      txnAmt: { color: c.onSurface, fontSize: 14, fontWeight: "800" },
      settleBtn: { backgroundColor: c.brandPrimary, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
      settleText: { color: c.onBrandPrimary, fontSize: 11, fontWeight: "700" },
    }))
  : () => ({});