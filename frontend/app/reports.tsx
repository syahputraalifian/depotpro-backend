import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, Modal } from "react-native";
import { useFocusEffect, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { makeStyles, useTheme } from "@/src/theme";
import { rupiah } from "@/src/format";
import { api } from "@/src/api";
import { useToast, Card, AppButton, Field } from "@/src/ui";

const PERIODS = [
  { key: "daily", label: "Harian" },
  { key: "monthly", label: "Bulanan" },
  { key: "yearly", label: "Tahunan" },
];

const EXP_CATS = [
  { key: "bbm", label: "BBM Armada" },
  { key: "gaji", label: "Gaji" },
  { key: "listrik", label: "Listrik" },
  { key: "maintenance_filter", label: "Perawatan Filter" },
  { key: "penyusutan", label: "Penyusutan" },
  { key: "sewa", label: "Sewa" },
  { key: "lainnya", label: "Lainnya" },
];

export default function Reports() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [period, setPeriod] = useState("monthly");
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expModal, setExpModal] = useState(false);
  const [expCat, setExpCat] = useState("bbm");
  const [expAmount, setExpAmount] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (p = period) => {
    try {
      const d = await api.get(`/finance/report?period=${p}`);
      setData(d);
    } catch (e: any) {
      toast(e.message, "error");
    }
  }, [period]);

  useFocusEffect(useCallback(() => { load(period); }, [period]));

  const onRefresh = async () => { setRefreshing(true); await load(period); setRefreshing(false); };

  const saveExpense = async () => {
    const amt = Number(expAmount);
    if (!amt || amt <= 0) { toast("Nominal tidak valid", "error"); return; }
    setSaving(true);
    try {
      await api.post("/finance/expense", { category: expCat, amount: amt, description: expDesc || undefined });
      toast("Beban operasional dicatat", "success");
      setExpModal(false); setExpAmount(""); setExpDesc("");
      load(period);
    } catch (e: any) { toast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const buildHTML = () => {
    if (!data) return "";
    const rows = (data.expenses || []).map((e: any) =>
      `<tr><td>${e.label}</td><td style="text-align:right">${rupiah(e.amount)}</td></tr>`).join("");
    return `<html><head><meta charset="utf-8"><style>
      body{font-family:-apple-system,Helvetica,Arial;padding:24px;color:#0F172A}
      h1{font-size:20px;margin:0} .sub{color:#64748B;margin:4px 0 18px}
      table{width:100%;border-collapse:collapse;margin-top:10px}
      td,th{padding:8px 6px;border-bottom:1px solid #E2E8F0;font-size:13px}
      .big{font-size:22px;font-weight:800} .lbl{color:#64748B;font-size:12px}
      .net{color:#15803D}</style></head><body>
      <h1>Laporan Keuangan — GasGalon ERP</h1>
      <div class="sub">Periode: ${data.label}</div>
      <div class="lbl">Total Omset Penjualan</div><div class="big">${rupiah(data.income_total)}</div>
      <table>
        <tr><td>Tunai</td><td style="text-align:right">${rupiah(data.income.cash)}</td></tr>
        <tr><td>Transfer</td><td style="text-align:right">${rupiah(data.income.transfer)}</td></tr>
        <tr><td>QRIS</td><td style="text-align:right">${rupiah(data.income.qris)}</td></tr>
        <tr><td>Deposit</td><td style="text-align:right">${rupiah(data.income.deposit)}</td></tr>
        <tr><td>Pelunasan Piutang</td><td style="text-align:right">${rupiah(data.income.piutang)}</td></tr>
      </table>
      <table>
        <tr><th style="text-align:left">Beban Operasional</th><th style="text-align:right">${rupiah(data.expenses_total)}</th></tr>
        ${rows}
      </table>
      <table>
        <tr><td>Total HPP Produk Terjual</td><td style="text-align:right">${rupiah(data.hpp_total)}</td></tr>
        <tr><td><b>Laba Bersih Operasional</b></td><td style="text-align:right" class="net"><b>${rupiah(data.net_profit)}</b></td></tr>
        <tr><td>Piutang Belum Lunas</td><td style="text-align:right">${rupiah(data.outstanding_total)}</td></tr>
      </table>
      </body></html>`;
  };

  const exportPDF = async () => {
    try {
      const { uri } = await Print.printToFileAsync({ html: buildHTML() });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
      else toast("Berbagi tidak tersedia di perangkat ini", "error");
    } catch (e: any) { toast("Gagal ekspor PDF", "error"); }
  };

  const exportCSV = async () => {
    if (!data) return;
    try {
      let csv = "Laporan Keuangan GasGalon\nPeriode," + data.label + "\n\nOMSET,Nominal\n";
      csv += `Tunai,${data.income.cash}\nTransfer,${data.income.transfer}\nQRIS,${data.income.qris}\nDeposit,${data.income.deposit}\nPelunasan Piutang,${data.income.piutang}\nTotal Omset,${data.income_total}\n\n`;
      csv += "BEBAN OPERASIONAL,Nominal\n";
      (data.expenses || []).forEach((e: any) => { csv += `${e.label},${e.amount}\n`; });
      csv += `Total Beban,${data.expenses_total}\n\nRINGKASAN,Nominal\nTotal HPP,${data.hpp_total}\nLaba Bersih,${data.net_profit}\nPiutang Belum Lunas,${data.outstanding_total}\n`;
      const uri = FileSystem.documentDirectory + `laporan-${data.period}.csv`;
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "text/csv" });
      else toast("Berbagi tidak tersedia di perangkat ini", "error");
    } catch (e: any) { toast("Gagal ekspor CSV", "error"); }
  };

  const maxTrend = Math.max(1, ...((data?.trend || []).map((t: any) => Math.max(t.income, Math.abs(t.profit)))));

  return (
    <View style={styles.root}>
      <Stack.Screen options={{
        title: "Laporan Keuangan", headerShown: true,
        headerStyle: { backgroundColor: colors.brand }, headerTintColor: colors.onBrand,
      }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        {/* Period filter */}
        <View style={styles.segment}>
          {PERIODS.map((p) => {
            const active = period === p.key;
            return (
              <Pressable key={p.key} testID={`period-${p.key}`} onPress={() => setPeriod(p.key)} style={[styles.seg, active && styles.segActive]}>
                <Text style={[styles.segText, active && styles.segTextActive]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {!data ? (
          <Text style={styles.loading}>Memuat laporan...</Text>
        ) : (
          <>
            <Text style={styles.periodLabel}>{data.label}</Text>

            {/* Net profit hero */}
            <Card style={styles.hero} testID="report-net">
              <Text style={styles.heroLabel}>Laba Bersih Operasional</Text>
              <Text style={[styles.heroValue, { color: data.net_profit >= 0 ? colors.success : colors.error }]}>{rupiah(data.net_profit)}</Text>
              <Text style={styles.heroSub}>Omset − HPP − Beban Operasional</Text>
            </Card>

            {/* Key metrics */}
            <View style={styles.grid}>
              <Card style={styles.mCard}><Text style={styles.mLabel}>Total Omset</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.mVal}>{rupiah(data.income_total)}</Text></Card>
              <Card style={styles.mCard}><Text style={styles.mLabel}>Total HPP</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.mVal}>{rupiah(data.hpp_total)}</Text></Card>
              <Card style={styles.mCard}><Text style={styles.mLabel}>Beban Operasional</Text><Text numberOfLines={1} adjustsFontSizeToFit style={[styles.mVal, { color: colors.warning }]}>{rupiah(data.expenses_total)}</Text></Card>
              <Card style={styles.mCard}><Text style={styles.mLabel}>Piutang Belum Lunas</Text><Text numberOfLines={1} adjustsFontSizeToFit style={[styles.mVal, { color: colors.error }]}>{rupiah(data.outstanding_total)}</Text></Card>
            </View>

            {/* Income breakdown */}
            <Card style={{ marginTop: 4 }}>
              <Text style={styles.sectionTitle}>Rincian Pemasukan</Text>
              {[["Tunai", data.income.cash], ["Transfer", data.income.transfer], ["QRIS", data.income.qris], ["Deposit", data.income.deposit], ["Pelunasan Piutang", data.income.piutang]].map(([l, v]: any) => (
                <View key={l} style={styles.lineRow}><Text style={styles.lineLabel}>{l}</Text><Text style={styles.lineVal}>{rupiah(v)}</Text></View>
              ))}
            </Card>

            {/* Trend chart */}
            <Card style={{ marginTop: 12 }}>
              <Text style={styles.sectionTitle}>Tren Keuangan</Text>
              <View style={styles.chart}>
                {(data.trend || []).map((t: any, i: number) => (
                  <View key={i} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View style={[styles.bar, { height: `${Math.max(2, (t.income / maxTrend) * 100)}%`, backgroundColor: colors.brandPrimary }]} />
                      <View style={[styles.bar, { height: `${Math.max(2, (Math.abs(t.profit) / maxTrend) * 100)}%`, backgroundColor: t.profit >= 0 ? colors.success : colors.error }]} />
                    </View>
                    <Text style={styles.barLabel} numberOfLines={1}>{t.label}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: colors.brandPrimary }]} /><Text style={styles.legendText}>Omset</Text></View>
                <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: colors.success }]} /><Text style={styles.legendText}>Laba</Text></View>
              </View>
            </Card>

            {/* Expenses breakdown */}
            <Card style={{ marginTop: 12 }}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Beban Operasional</Text>
                <Pressable testID="add-expense-button" onPress={() => setExpModal(true)} style={styles.addExpBtn}>
                  <Icon name="add" size={16} color={colors.onBrandPrimary} />
                  <Text style={styles.addExpText}>Catat Beban</Text>
                </Pressable>
              </View>
              {(data.expenses || []).length === 0 ? (
                <Text style={styles.empty}>Belum ada beban pada periode ini</Text>
              ) : (
                data.expenses.map((e: any) => (
                  <View key={e.category} style={styles.lineRow}><Text style={styles.lineLabel}>{e.label}</Text><Text style={[styles.lineVal, { color: colors.warning }]}>{rupiah(e.amount)}</Text></View>
                ))
              )}
            </Card>

            {/* Export */}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <AppButton title="Ekspor PDF" icon="document-text-outline" onPress={exportPDF} testID="export-pdf" style={{ flex: 1 }} />
              <AppButton title="Ekspor CSV" icon="grid-outline" variant="secondary" onPress={exportCSV} testID="export-csv" style={{ flex: 1 }} />
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={expModal} animationType="slide" transparent onRequestClose={() => setExpModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setExpModal(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.sheetTitle}>Catat Beban Operasional</Text>
          <Text style={styles.mLabel}>Kategori</Text>
          <View style={styles.catWrap}>
            {EXP_CATS.map((ct) => {
              const active = expCat === ct.key;
              return (
                <Pressable key={ct.key} testID={`exp-cat-${ct.key}`} onPress={() => setExpCat(ct.key)} style={[styles.catChip, active && styles.catChipActive]}>
                  <Text style={[styles.catText, active && styles.catTextActive]}>{ct.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Field label="Nominal (Rp)" value={expAmount} onChangeText={setExpAmount} keyboardType="numeric" placeholder="100000" testID="exp-amount" />
          <Field label="Keterangan (opsional)" value={expDesc} onChangeText={setExpDesc} placeholder="Isi solar armada" testID="exp-desc" />
          <AppButton title="Simpan Beban" onPress={saveExpense} loading={saving} testID="save-expense" style={{ marginTop: 12 }} />
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  segment: { flexDirection: "row", backgroundColor: c.surfaceTertiary, borderRadius: 12, padding: 4, marginBottom: 14 },
  seg: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 9 },
  segActive: { backgroundColor: c.brandPrimary },
  segText: { fontSize: 14, fontWeight: "700", color: c.onSurfaceTertiary },
  segTextActive: { color: c.onBrandPrimary },
  loading: { color: c.muted, textAlign: "center", marginTop: 40 },
  periodLabel: { fontSize: 15, fontWeight: "700", color: c.onSurface, marginBottom: 10 },
  hero: { alignItems: "center", paddingVertical: 20 },
  heroLabel: { fontSize: 13, color: c.muted, fontWeight: "600" },
  heroValue: { fontSize: 30, fontWeight: "800", marginTop: 6 },
  heroSub: { fontSize: 12, color: c.muted, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12, marginBottom: 6 },
  mCard: { width: "47.5%" },
  mLabel: { fontSize: 12, color: c.muted, fontWeight: "600" },
  mVal: { fontSize: 17, fontWeight: "800", color: c.onSurface, marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: c.onSurface, marginBottom: 8 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  lineRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.divider },
  lineLabel: { fontSize: 14, color: c.onSurfaceSecondary },
  lineVal: { fontSize: 14, fontWeight: "700", color: c.onSurface },
  empty: { color: c.muted, fontSize: 13, paddingVertical: 8 },
  chart: { flexDirection: "row", alignItems: "flex-end", height: 150, gap: 4, marginTop: 4 },
  barCol: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end" },
  barTrack: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: "88%" },
  bar: { width: 7, borderRadius: 3 },
  barLabel: { fontSize: 9, color: c.muted, marginTop: 4 },
  legendRow: { flexDirection: "row", gap: 18, marginTop: 12, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: c.muted },
  addExpBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.brandPrimary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  addExpText: { color: c.onBrandPrimary, fontWeight: "700", fontSize: 12 },
  catWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12, marginTop: 6 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: c.surfaceTertiary },
  catChipActive: { backgroundColor: c.brandPrimary },
  catText: { fontSize: 12, fontWeight: "600", color: c.onSurfaceTertiary },
  catTextActive: { color: c.onBrandPrimary },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: c.onSurface, marginBottom: 12 },
}));
