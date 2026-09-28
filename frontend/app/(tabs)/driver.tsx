import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { makeStyles, useTheme } from "@/src/theme";
import { useAuth } from "@/src/auth/AuthContext";
import { api } from "@/src/api";
import { rupiah, shortDate } from "@/src/format";
import { AppButton, Badge, Field, EmptyState, useToast } from "@/src/ui";

export default function Driver() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const toast = useToast();
  const isOwner = user?.role === "owner";

  const [products, setProducts] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selDriver, setSelDriver] = useState<string>(user?.role === "driver" ? user.id : "");
  const [loads, setLoads] = useState<Record<string, { out: string; ret: string }>>({});
  const [actual, setActual] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, h] = await Promise.all([api.get("/products"), api.get("/recon")]);
      setProducts(p.filter((x: any) => x.is_returnable));
      setHistory(h);
      if (isOwner) setDrivers(await api.get("/users/drivers"));
    } catch (e: any) { toast(e.message, "error"); }
  }, [isOwner]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const setLoad = (id: string, key: "out" | "ret", v: string) =>
    setLoads((prev) => ({ ...prev, [id]: { out: prev[id]?.out || "", ret: prev[id]?.ret || "", [key]: v } }));

  const expected = products.reduce((s, p) => {
    const l = loads[p.id];
    if (!l) return s;
    const sold = Number(l.out || 0) - Number(l.ret || 0);
    return s + Math.max(sold, 0) * Number(p.price_eceran);
  }, 0);
  const diff = Number(actual || 0) - expected;

  const submit = async () => {
    const driverId = isOwner ? selDriver : user?.id;
    if (!driverId) { toast("Pilih driver", "error"); return; }
    const payloadLoads = products
      .filter((p) => loads[p.id] && Number(loads[p.id].out || 0) > 0)
      .map((p) => ({ product_id: p.id, name: p.name, price: Number(p.price_eceran), qty_out: Number(loads[p.id].out || 0), qty_return: Number(loads[p.id].ret || 0) }));
    if (payloadLoads.length === 0) { toast("Isi muatan berangkat", "error"); return; }
    setSubmitting(true);
    try {
      const res = await api.post("/recon", { driver_id: driverId, loads: payloadLoads, actual_deposit: Number(actual || 0) });
      toast(res.difference < 0 ? `Selisih kurang ${rupiah(Math.abs(res.difference))} → dicatat kasbon` : "Setoran seimbang!", res.difference < 0 ? "error" : "success");
      setLoads({}); setActual(""); load();
    } catch (e: any) { toast(e.message, "error"); } finally { setSubmitting(false); }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Rekonsiliasi Driver</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}>

        {isOwner && (
          <>
            <Text style={styles.section}>Pilih Driver</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
              {drivers.map((d) => (
                <Pressable key={d.id} testID={`driver-${d.id}`} onPress={() => setSelDriver(d.id)} style={[styles.dChip, selDriver === d.id && styles.dChipActive]}>
                  <Text style={[styles.dChipText, selDriver === d.id && styles.dChipTextActive]}>{d.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        <Text style={styles.section}>Muatan Hari Ini</Text>
        <View style={styles.tblHead}>
          <Text style={[styles.th, { flex: 2 }]}>Produk</Text>
          <Text style={[styles.th, styles.thNum]}>Berangkat</Text>
          <Text style={[styles.th, styles.thNum]}>Kembali</Text>
        </View>
        {products.map((p) => (
          <View key={p.id} style={styles.loadRow}>
            <View style={{ flex: 2 }}>
              <Text style={styles.pName}>{p.name}</Text>
              <Text style={styles.pPrice}>{rupiah(p.price_eceran)}</Text>
            </View>
            <TextInput testID={`out-${p.id}`} style={styles.numInput} keyboardType="numeric" placeholder="0"
              placeholderTextColor={colors.muted} value={loads[p.id]?.out || ""} onChangeText={(v) => setLoad(p.id, "out", v)} />
            <TextInput testID={`ret-${p.id}`} style={styles.numInput} keyboardType="numeric" placeholder="0"
              placeholderTextColor={colors.muted} value={loads[p.id]?.ret || ""} onChangeText={(v) => setLoad(p.id, "ret", v)} />
          </View>
        ))}

        <View style={styles.calcCard}>
          <View style={styles.calcRow}><Text style={styles.calcLabel}>Tagihan Setoran (otomatis)</Text><Text style={styles.calcVal}>{rupiah(expected)}</Text></View>
          <Field label="Setoran Aktual Diterima" value={actual} onChangeText={setActual} keyboardType="numeric" placeholder="0" testID="actual-deposit-input" />
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Selisih</Text>
            <Text style={[styles.calcVal, { color: diff < 0 ? colors.error : colors.success }]}>{rupiah(diff)}</Text>
          </View>
          {diff < 0 && <Text style={styles.warnText}>Selisih minus akan dicatat sebagai kasbon/potongan gaji</Text>}
        </View>

        <AppButton title="Simpan Rekonsiliasi" onPress={submit} loading={submitting} icon="checkmark-circle-outline" testID="submit-recon-button" />

        <Text style={[styles.section, { marginTop: 28 }]}>Riwayat Setoran</Text>
        {history.length === 0 ? <EmptyState icon="receipt-outline" title="Belum ada rekonsiliasi" /> : history.map((h) => (
          <View key={h.id} style={styles.histCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={styles.histName}>{h.driver_name}</Text>
                <Text style={styles.histMeta}>{shortDate(h.created_at)} • {h.delivered_units} unit terjual</Text>
              </View>
              <Badge text={h.status === "shortage" ? "Kurang Setor" : "Seimbang"} bg={h.status === "shortage" ? colors.receivableBadge : colors.brandTertiary} fg={h.status === "shortage" ? colors.onReceivableBadge : colors.onBrandTertiary} />
            </View>
            <View style={styles.histRow}>
              <Text style={styles.histSmall}>Tagihan: {rupiah(h.expected_deposit)}</Text>
              <Text style={styles.histSmall}>Aktual: {rupiah(h.actual_deposit)}</Text>
              <Text style={[styles.histSmall, { color: h.difference < 0 ? colors.error : colors.success, fontWeight: "800" }]}>Selisih: {rupiah(h.difference)}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: 16, paddingBottom: 14, backgroundColor: c.brand, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
  title: { color: c.onBrandPrimary, fontSize: 20, fontWeight: "800" },
  section: { fontSize: 14, fontWeight: "800", color: c.onSurface, marginBottom: 10 },
  dChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: c.surfaceTertiary },
  dChipActive: { backgroundColor: c.brandPrimary },
  dChipText: { color: c.onSurfaceTertiary, fontWeight: "600", fontSize: 13 },
  dChipTextActive: { color: c.onBrandPrimary },
  tblHead: { flexDirection: "row", paddingHorizontal: 12, marginBottom: 6 },
  th: { fontSize: 11, color: c.muted, fontWeight: "700" },
  thNum: { flex: 1, textAlign: "center" },
  loadRow: { flexDirection: "row", alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: c.border, gap: 8 },
  pName: { fontSize: 13, fontWeight: "700", color: c.onSurface },
  pPrice: { fontSize: 11, color: c.muted, marginTop: 2 },
  numInput: { flex: 1, backgroundColor: c.surfaceTertiary, borderRadius: 8, textAlign: "center", paddingVertical: 10, fontSize: 15, fontWeight: "700", color: c.onSurface, borderWidth: 1, borderColor: c.border },
  calcCard: { backgroundColor: c.surfaceSecondary, borderRadius: 14, padding: 16, marginTop: 8, marginBottom: 16, borderWidth: 1, borderColor: c.border },
  calcRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  calcLabel: { fontSize: 13, color: c.onSurfaceSecondary, fontWeight: "600" },
  calcVal: { fontSize: 18, fontWeight: "800", color: c.onSurface },
  warnText: { fontSize: 12, color: c.error, marginTop: 4 },
  histCard: { backgroundColor: c.surfaceSecondary, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: c.border },
  histName: { fontSize: 14, fontWeight: "700", color: c.onSurface },
  histMeta: { fontSize: 11, color: c.muted, marginTop: 2 },
  histRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, flexWrap: "wrap", gap: 6 },
  histSmall: { fontSize: 11, color: c.onSurfaceSecondary },
}));
