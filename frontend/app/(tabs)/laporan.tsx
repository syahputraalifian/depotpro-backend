import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import * as authModule from "@/src/auth/AuthContext";
import * as apiModule from "@/src/api";
import * as formatModule from "@/src/format";
import * as uiModule from "@/src/ui";

const { EmptyState } = uiModule;

const safeRupiah = (val: any) => {
  const formatFunc =
    (formatModule as any)?.rupiah || (formatModule as any)?.default;
  if (typeof formatFunc === "function") {
    try {
      return formatFunc(val);
    } catch {
      return `Rp ${val || 0}`;
    }
  }
  return `Rp ${(val || 0).toLocaleString("id-ID")}`;
};

const RANGES = [
  { key: "today", label: "Hari Ini" },
  { key: "week", label: "Minggu Ini" },
  { key: "month", label: "Bulan Ini" },
];

export default function LaporanScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const useAuthHook = (authModule as any)?.useAuth;
  const authContext = typeof useAuthHook === "function" ? useAuthHook() : null;
  const user = authContext?.user;

  const showToast = useCallback((msg: string, type?: string) => {
    try {
      const useToastHook = (uiModule as any)?.useToast;
      if (typeof useToastHook === "function") {
        const toast = useToastHook();
        if (typeof toast === "function") {
          toast(msg, type);
          return;
        } else if (toast?.show) {
          toast.show(msg, type);
          return;
        }
      }
    } catch {
      console.log(`[Toast ${type || "info"}]:`, msg);
    }
  }, []);

  const [range, setRange] = useState("month");
  const [reportData, setReportData] = useState<any>(null);
  const [assetReport, setAssetReport] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const getApi = (apiModule as any)?.api || (apiModule as any)?.default;

  const loadData = useCallback(async () => {
    try {
      if (getApi && typeof getApi.get === "function") {
        const [repRes, astRes] = await Promise.all([
          getApi.get(`/reports/profit-loss?range=${range}`).catch(() => null),
          getApi.get("/reports/asset-containers").catch(() => null),
        ]);
        setReportData(repRes || {});
        setAssetReport(astRes || {});
      }
    } catch (e: any) {
      showToast(e?.message || "Gagal memuat laporan keuangan", "error");
    }
  }, [getApi, range, showToast]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const revenue = Number(reportData?.total_revenue || 0);
  const cogs = Number(reportData?.total_cogs || 0);
  const freight = Number(reportData?.total_freight_cost || 0);
  const depreciation = Number(reportData?.total_depreciation || 0);
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - freight - depreciation;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Laporan & Analisis</Text>
      </View>

      {/* Selector Rentang Waktu */}
      <View style={styles.rangeWrap}>
        <View style={styles.rangeBar}>
          {RANGES.map((r) => {
            const active = range === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => setRange(r.key)}
                style={[styles.rangeTab, active && styles.rangeTabActive]}
              >
                <Text
                  style={[
                    styles.rangeText,
                    active && styles.rangeTextActive,
                  ]}
                >
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brandPrimary}
          />
        }
      >
        {/* Ringkasan Laba Bersih Utama */}
        <View style={styles.netProfitCard}>
          <Text style={styles.npLabel}>
            Laba Bersih ({RANGES.find((r) => r.key === range)?.label})
          </Text>
          <Text
            style={[
              styles.npValue,
              { color: netProfit >= 0 ? colors.success : colors.error },
            ]}
          >
            {safeRupiah(netProfit)}
          </Text>
          <Text style={styles.npSub}>
            Omzet {safeRupiah(revenue)} • {reportData?.total_orders || 0} Transaksi
          </Text>
        </View>

        {/* Breakdown Laba Rugi */}
        <Text style={styles.sectionTitle}>Rincian Laba / Rugi</Text>
        <View style={styles.card}>
          <View style={styles.lrRow}>
            <Text style={styles.lrLabel}>Pendapatan Kotor (Omzet)</Text>
            <Text style={[styles.lrValue, { color: colors.onSurface }]}>
              {safeRupiah(revenue)}
            </Text>
          </View>

          <View style={styles.lrRow}>
            <Text style={styles.lrLabel}>Harga Pokok Penjualan (HPP)</Text>
            <Text style={[styles.lrValue, { color: colors.error }]}>
              - {safeRupiah(cogs)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.lrRow}>
            <Text style={[styles.lrLabel, { fontWeight: "700" }]}>
              Laba Kotor
            </Text>
            <Text
              style={[
                styles.lrValue,
                { fontWeight: "800", color: colors.brandPrimary },
              ]}
            >
              {safeRupiah(grossProfit)}
            </Text>
          </View>

          <View style={[styles.lrRow, { marginTop: 10 }]}>
            <Text style={styles.lrLabel}>Biaya Transportasi / Ongkir</Text>
            <Text style={[styles.lrValue, { color: colors.muted }]}>
              - {safeRupiah(freight)}
            </Text>
          </View>

          <View style={styles.lrRow}>
            <Text style={styles.lrLabel}>Penyusutan Wadah (Aset)</Text>
            <Text style={[styles.lrValue, { color: colors.muted }]}>
              - {safeRupiah(depreciation)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.lrRow}>
            <Text style={[styles.lrLabel, { fontWeight: "800", fontSize: 14 }]}>
              Laba Bersih Operasional
            </Text>
            <Text
              style={[
                styles.lrValue,
                {
                  fontWeight: "800",
                  fontSize: 15,
                  color: netProfit >= 0 ? colors.success : colors.error,
                },
              ]}
            >
              {safeRupiah(netProfit)}
            </Text>
          </View>
        </View>

        {/* Status Aset Wadah Depot (Galon & Tabung Gas) */}
        <Text style={styles.sectionTitle}>Status Aset Wadah Galon & Gas</Text>
        <View style={styles.card}>
          <View style={styles.assetGrid}>
            <View style={styles.assetBox}>
              <Icon name="cube-outline" size={22} color={colors.brandPrimary} />
              <Text style={styles.assetVal}>
                {assetReport?.total_filled ?? 0}
              </Text>
              <Text style={styles.assetLbl}>Stok Isi</Text>
            </View>

            <View style={styles.assetBox}>
              <Icon name="repeat-outline" size={22} color={colors.assetGallon} />
              <Text style={styles.assetVal}>
                {assetReport?.total_empty ?? 0}
              </Text>
              <Text style={styles.assetLbl}>Wadah Kosong</Text>
            </View>

            <View style={styles.assetBox}>
              <Icon name="people-outline" size={22} color={colors.warning} />
              <Text style={styles.assetVal}>
                {assetReport?.total_with_customers ?? 0}
              </Text>
              <Text style={styles.assetLbl}>Di Pelanggan</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: c.brand,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  title: { color: c.onBrandPrimary, fontSize: 20, fontWeight: "800" },
  rangeWrap: {
    backgroundColor: c.surfaceSecondary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  rangeBar: {
    flexDirection: "row",
    backgroundColor: c.surfaceTertiary,
    borderRadius: 10,
    padding: 3,
  },
  rangeTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 8,
  },
  rangeTabActive: { backgroundColor: c.brandPrimary },
  rangeText: { fontSize: 12, fontWeight: "600", color: c.muted },
  rangeTextActive: { color: c.onBrandPrimary, fontWeight: "800" },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: c.muted,
    marginBottom: 8,
    marginTop: 12,
  },
  netProfitCard: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
  },
  npLabel: { fontSize: 12, color: c.muted, fontWeight: "600" },
  npValue: { fontSize: 26, fontWeight: "800", marginVertical: 4 },
  npSub: { fontSize: 11, color: c.muted },
  card: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: c.border,
  },
  lrRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 4,
  },
  lrLabel: { fontSize: 12, color: c.muted },
  lrValue: { fontSize: 13, fontWeight: "700" },
  divider: {
    height: 1,
    backgroundColor: c.border,
    marginVertical: 8,
  },
  assetGrid: { flexDirection: "row", gap: 10 },
  assetBox: {
    flex: 1,
    backgroundColor: c.surfaceTertiary,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  assetVal: {
    fontSize: 18,
    fontWeight: "800",
    color: c.onSurface,
    marginTop: 4,
  },
  assetLbl: { fontSize: 10, color: c.muted, marginTop: 2, textAlign: "center" },
}));