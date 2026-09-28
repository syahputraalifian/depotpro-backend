import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, Modal, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { api } from "@/src/api";
import { rupiah, TIER_LABELS, shortDate, PAYMENT_LABELS } from "@/src/format";
import { AppButton, Badge, Field, EmptyState, useToast } from "@/src/ui";

const TYPES = [
  { key: "rumahan", tier: "eceran" },
  { key: "warung", tier: "warung" },
  { key: "pangkalan", tier: "pangkalan" },
  { key: "korporat", tier: "korporat" },
];

export default function Pelanggan() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [customers, setCustomers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [detailTxns, setDetailTxns] = useState<any[]>([]);
  const [topup, setTopup] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ name: "", type: "warung", phone: "", address: "", credit_limit: "", payment_terms_days: "7", deposit_balance: "" });

  const load = useCallback(async () => {
    try { setCustomers(await api.get("/customers")); } catch (e: any) { toast(e.message, "error"); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  const openDetail = async (c: any) => {
    setDetail(c);
    try { setDetailTxns(await api.get(`/customers/${c.id}/transactions`)); } catch { setDetailTxns([]); }
  };

  const saveCustomer = async () => {
    if (!form.name) { toast("Nama wajib diisi", "error"); return; }
    setSaving(true);
    try {
      const tier = TYPES.find((t) => t.key === form.type)?.tier || "eceran";
      await api.post("/customers", {
        name: form.name, type: form.type, tier, phone: form.phone, address: form.address,
        credit_limit: Number(form.credit_limit || 0), payment_terms_days: Number(form.payment_terms_days || 7),
        deposit_balance: Number(form.deposit_balance || 0),
      });
      toast("Pelanggan ditambahkan", "success");
      setAddModal(false); setForm({ name: "", type: "warung", phone: "", address: "", credit_limit: "", payment_terms_days: "7", deposit_balance: "" }); load();
    } catch (e: any) { toast(e.message, "error"); } finally { setSaving(false); }
  };

  const doTopup = async () => {
    const amt = Number(topup || 0);
    if (amt <= 0) { toast("Masukkan nominal", "error"); return; }
    try {
      await api.post(`/customers/${detail.id}/deposit?amount=${amt}`);
      toast("Deposit ditambahkan", "success");
      setTopup(""); await load();
      const updated = (await api.get("/customers")).find((x: any) => x.id === detail.id);
      setDetail(updated);
    } catch (e: any) { toast(e.message, "error"); }
  };

  const settle = async (tid: string) => {
    try {
      await api.post(`/transactions/${tid}/pay`);
      toast("Piutang dilunasi", "success");
      await load(); openDetail((await api.get("/customers")).find((x: any) => x.id === detail.id));
    } catch (e: any) { toast(e.message, "error"); }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Pelanggan & Piutang</Text>
        <Pressable testID="add-customer-button" onPress={() => setAddModal(true)} style={styles.addBtn}>
          <Icon name="add" size={22} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}>
        {customers.map((c) => (
          <Pressable key={c.id} testID={`customer-card-${c.id}`} onPress={() => openDetail(c)} style={styles.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.phone}>{c.phone || "Tanpa nomor"}</Text>
              </View>
              <Badge text={TIER_LABELS[c.tier]} bg={colors.brandTertiary} fg={colors.onBrandTertiary} />
            </View>
            <View style={styles.row}>
              <View style={styles.metric}><Text style={styles.mLabel}>Deposit</Text><Text style={[styles.mVal, { color: colors.success }]}>{rupiah(c.deposit_balance)}</Text></View>
              <View style={styles.metric}><Text style={styles.mLabel}>Piutang</Text><Text style={[styles.mVal, { color: c.receivable_balance > 0 ? colors.error : colors.muted }]}>{rupiah(c.receivable_balance)}</Text></View>
              <View style={styles.metric}><Text style={styles.mLabel}>Plafon</Text><Text style={styles.mVal}>{rupiah(c.credit_limit)}</Text></View>
            </View>
          </Pressable>
        ))}
        {customers.length === 0 && <EmptyState icon="people-outline" title="Belum ada pelanggan" subtitle="Tambah pangkalan / warung / pelanggan" />}
      </ScrollView>

      {/* Add modal */}
      <Modal visible={addModal} animationType="slide" transparent onRequestClose={() => setAddModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAddModal(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, maxHeight: "88%" }]}>
          <Text style={styles.sheetTitle}>Tambah Pelanggan</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Field label="Nama" value={form.name} onChangeText={(v: string) => set("name", v)} placeholder="Pangkalan Jaya" testID="cf-name" />
            <Text style={styles.fieldLabel}>Tipe / Tingkat Harga</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {TYPES.map((t) => (
                <Pressable key={t.key} testID={`cf-type-${t.key}`} onPress={() => set("type", t.key)} style={[styles.typeBtn, form.type === t.key && styles.typeBtnActive]}>
                  <Text style={[styles.typeText, form.type === t.key && styles.typeTextActive]}>{TIER_LABELS[t.tier]}</Text>
                </Pressable>
              ))}
            </View>
            <Field label="No. WhatsApp" value={form.phone} onChangeText={(v: string) => set("phone", v)} keyboardType="phone-pad" placeholder="08123456789" />
            <Field label="Alamat" value={form.address} onChangeText={(v: string) => set("address", v)} placeholder="Jl. ..." />
            <Field label="Plafon Kredit (Tempo)" value={form.credit_limit} onChangeText={(v: string) => set("credit_limit", v)} keyboardType="numeric" placeholder="5000000" />
            <Field label="Termin Pembayaran (hari)" value={form.payment_terms_days} onChangeText={(v: string) => set("payment_terms_days", v)} keyboardType="numeric" placeholder="7" />
            <Field label="Saldo Deposit Awal" value={form.deposit_balance} onChangeText={(v: string) => set("deposit_balance", v)} keyboardType="numeric" placeholder="0" />
            <AppButton title="Simpan" onPress={saveCustomer} loading={saving} icon="save-outline" testID="save-customer-button" />
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Detail modal */}
      <Modal visible={!!detail} animationType="slide" transparent onRequestClose={() => setDetail(null)}>
        <Pressable style={styles.backdrop} onPress={() => setDetail(null)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, maxHeight: "88%" }]}>
          <Text style={styles.sheetTitle}>{detail?.name}</Text>
          <Text style={styles.sheetSub}>{detail && TIER_LABELS[detail.tier]} • {detail?.phone}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.detailRow}>
              <View style={styles.detailBox}><Text style={styles.mLabel}>Deposit</Text><Text style={[styles.mVal, { color: colors.success }]}>{rupiah(detail?.deposit_balance)}</Text></View>
              <View style={styles.detailBox}><Text style={styles.mLabel}>Piutang</Text><Text style={[styles.mVal, { color: colors.error }]}>{rupiah(detail?.receivable_balance)}</Text></View>
            </View>
            <Field label="Top-up Deposit" value={topup} onChangeText={setTopup} keyboardType="numeric" placeholder="Nominal" testID="topup-input" />
            <AppButton title="Tambah Deposit" onPress={doTopup} variant="secondary" icon="add-circle-outline" testID="topup-button" />
            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Riwayat Transaksi</Text>
            {detailTxns.length === 0 ? <Text style={styles.sheetSub}>Belum ada transaksi</Text> : detailTxns.map((t) => (
              <View key={t.id} style={styles.txnRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnName}>{t.invoice_no}</Text>
                  <Text style={styles.txnMeta}>{PAYMENT_LABELS[t.payment_method]} • {shortDate(t.created_at)}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={styles.txnAmt}>{rupiah(t.total)}</Text>
                  {t.status === "outstanding" && (
                    <Pressable testID={`settle-${t.id}`} onPress={() => settle(t.id)} style={styles.settleBtn}>
                      <Text style={styles.settleText}>Lunasi</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
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
  txnRow: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: c.divider, paddingBottom: 12 },
  txnName: { color: c.onSurface, fontSize: 14, fontWeight: "700" },
  txnMeta: { color: c.muted, fontSize: 11, marginTop: 2 },
  txnAmt: { color: c.onSurface, fontSize: 14, fontWeight: "800" },
  settleBtn: { backgroundColor: c.brandPrimary, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  settleText: { color: c.onBrandPrimary, fontSize: 11, fontWeight: "700" },
}));
