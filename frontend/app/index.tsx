import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { api } from "@/src/api";
import * as formatModule from "@/src/format";

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

export default function DashboardScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashData, setDashData] = useState<any>({
    revenue: 0,
    transactions_count: 0,
    low_stock_count: 0,
    recent_transactions: [],
    low_stock_items: [],
  });

  const [products, setProducts] = useState<any[]>([]);

  const fetchDashboard = async () => {
    try {
      const getApi = typeof api?.get === "function" ? api.get : null;
      if (getApi) {
        const [dashRes, prodRes] = await Promise.all([
          getApi("/dashboard"),
          getApi("/products"),
        ]);

        if (dashRes) setDashData(dashRes);
        if (Array.isArray(prodRes)) setProducts(prodRes);
        else if (prodRes?.data) setProducts(prodRes.data);
      }
    } catch (e) {
      console.log("Error loading dashboard:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  // Kalkulasi Stok Operasional
  const totalLPGStock = products
    .filter((p) => p.category === "lpg")
    .reduce((sum, p) => sum + (p.stock_filled || 0), 0);

  const totalGalonStock = products
    .filter((p) => p.category === "galon_brand" || p.category === "isi_ulang")
    .reduce((sum, p) => sum + (p.stock_filled || 0), 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header Utama */}
      <View style={styles.header}>
        <View style={styles.headerUserRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>DP</Text>
          </View>
          <View>
            <Text style={styles.headerGreeting}>Selamat Datang,</Text>
            <Text style={styles.headerTitle}>Owner DepotPro ERP</Text>
          </View>
        </View>

        <Pressable onPress={onRefresh} style={styles.refreshBtn}>
          <Icon name="refresh" size={20} color="#fff" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
          <Text style={styles.loadingText}>Menyiapkan Statistik Depot...</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Main Hero Card: Total Omzet */}
          <View style={styles.mainCard}>
            <View style={styles.mainCardHeader}>
              <Text style={styles.mainCardLabel}>Total Omzet Real-Time</Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>ONLINE</Text>
              </View>
            </View>

            <Text style={styles.mainCardValue}>{safeRupiah(dashData?.revenue || 0)}</Text>

            <View style={styles.mainCardSubRow}>
              <View style={styles.subMetric}>
                <Icon name="checkmark-circle-outline" size={14} color="#fff" />
                <Text style={styles.subMetricText}>
                  {dashData?.transactions_count || 0} Transaksi Selesai
                </Text>
              </View>
              <View style={styles.subMetric}>
                <Icon name="trending-up-outline" size={14} color="#fff" />
                <Text style={styles.subMetricText}>Performa Positif</Text>
              </View>
            </View>
          </View>

          {/* Grid Stats Operasional */}
          <Text style={styles.sectionTitle}>Ringkasan Stok Operasional</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: "#e0f2fe" }]}>
                <Icon name="flame" size={20} color="#0284c7" />
              </View>
              <Text style={styles.statValue}>{totalLPGStock} Tabung</Text>
              <Text style={styles.statLabel}>Stok LPG Terisi</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: "#dcfce7" }]}>
                <Icon name="water" size={20} color="#16a34a" />
              </View>
              <Text style={styles.statValue}>{totalGalonStock} Galon</Text>
              <Text style={styles.statLabel}>Stok Galon Terisi</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: "#fef3c7" }]}>
                <Icon name="warning" size={20} color="#d97706" />
              </View>
              <Text style={[styles.statValue, { color: dashData?.low_stock_count > 0 ? "#e11d48" : colors.onSurface }]}>
                {dashData?.low_stock_count || 0} Produk
              </Text>
              <Text style={styles.statLabel}>Stok Kritis</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: "#f3e8ff" }]}>
                <Icon name="receipt" size={20} color="#9333ea" />
              </View>
              <Text style={styles.statValue}>{dashData?.transactions_count || 0}</Text>
              <Text style={styles.statLabel}>Total Penjualan</Text>
            </View>
          </View>

          {/* Quick Access Menu / Actions Grid */}
          <Text style={styles.sectionTitle}>Akses Cepat Fitur</Text>
          <View style={styles.actionGrid}>
            {[
              { title: "Kasir (POS)", icon: "cart", route: "/(tabs)/pos", color: colors.brandPrimary },
              { title: "Kelola Stok", icon: "cube", route: "/(tabs)/stok", color: "#0284c7" },
              { title: "Pelanggan", icon: "people", route: "/(tabs)/pelanggan", color: "#16a34a" },
              { title: "Kurir Driver", icon: "bicycle", route: "/(tabs)/driver", color: "#d97706" },
              { title: "Laporan", icon: "document-text", route: "/(tabs)/laporan", color: "#9333ea" },
              { title: "Setoran Kas", icon: "wallet", route: "/(tabs)/setoran", color: "#059669" },
            ].map((item, idx) => (
              <Pressable
                key={idx}
                style={styles.actionCard}
                onPress={() => router.push(item.route as any)}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: item.color }]}>
                  <Icon name={item.icon} size={20} color="#fff" />
                </View>
                <Text style={styles.actionText}>{item.title}</Text>
              </Pressable>
            ))}
          </View>

          {/* Alert Stok Kritis (jika ada) */}
          {(dashData?.low_stock_items || []).length > 0 && (
            <View style={styles.alertBox}>
              <View style={styles.alertHeader}>
                <Icon name="alert-circle" size={20} color="#e11d48" />
                <Text style={styles.alertTitle}>Peringatan Stok Rendah!</Text>
              </View>
              {dashData.low_stock_items.map((item: any, idx: number) => (
                <Text key={idx} style={styles.alertText}>
                  • {item.name}: Tersisa <Text style={{ fontWeight: "800", color: "#e11d48" }}>{item.stock_filled || 0}</Text> terisi (Batas reorder: {item.reorder_point || 10})
                </Text>
              ))}
            </View>
          )}

          {/* Transaksi Terakhir */}
          <View style={styles.txHeaderRow}>
            <Text style={styles.sectionTitle}>Transaksi Terakhir</Text>
            <Pressable onPress={() => router.push("/(tabs)/laporan")}>
              <Text style={styles.seeAllText}>Lihat Semua &gt;</Text>
            </Pressable>
          </View>

          {(dashData?.recent_transactions || []).length === 0 ? (
            <View style={styles.emptyCard}>
              <Icon name="receipt-outline" size={32} color={colors.muted} />
              <Text style={styles.emptyText}>Belum ada transaksi recorded hari ini</Text>
            </View>
          ) : (
            dashData.recent_transactions.slice(0, 5).map((tx: any, idx: number) => (
              <View key={tx?.id || idx} style={styles.txCard}>
                <View style={styles.txIconCircle}>
                  <Icon
                    name={tx?.payment_method === "qris" ? "qr-code" : tx?.payment_method === "transfer" ? "card" : "cash"}
                    size={18}
                    color={colors.brandPrimary}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.txCustomer}>{tx?.customer_name || "Pelanggan Umum"}</Text>
                  <Text style={styles.txMeta}>
                    {(tx?.payment_method || "cash").toUpperCase()} •{" "}
                    {tx?.created_at
                      ? new Date(tx.created_at).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Baru saja"}
                  </Text>
                </View>
                <Text style={styles.txAmount}>{safeRupiah(tx?.total_amount || 0)}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: {
    flexDirection: "row",
    justify: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: c.brandPrimary,
  },
  headerUserRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  headerGreeting: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "600" },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  refreshBtn: { padding: 6 },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 8, fontSize: 13, color: c.muted },
  mainCard: {
    backgroundColor: c.brandPrimary,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    elevation: 3,
  },
  mainCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  mainCardLabel: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" },
  liveBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  mainCardValue: { color: "#fff", fontSize: 28, fontWeight: "800", marginVertical: 8 },
  mainCardSubRow: { flexDirection: "row", gap: 14, marginTop: 4 },
  subMetric: { flexDirection: "row", alignItems: "center", gap: 4 },
  subMetricText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: c.onSurface, marginBottom: 10 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard: {
    width: "48%",
    backgroundColor: c.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  statIconBox: { width: 34, height: 34, borderRadius: 8, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  statValue: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  statLabel: { fontSize: 11, color: c.muted, marginTop: 2 },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  actionCard: {
    width: "31%",
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
  },
  actionIconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 6 },
  actionText: { fontSize: 11, fontWeight: "700", color: c.onSurface, textAlign: "center" },
  alertBox: {
    backgroundColor: "#fff1f2",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fecdd3",
    marginBottom: 20,
  },
  alertHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  alertTitle: { fontSize: 13, fontWeight: "800", color: "#e11d48" },
  alertText: { fontSize: 12, color: "#9f1239", marginBottom: 2 },
  txHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  seeAllText: { fontSize: 12, fontWeight: "700", color: c.brandPrimary },
  emptyCard: { padding: 24, alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: 12 },
  emptyText: { marginTop: 6, color: c.muted, fontSize: 12 },
  txCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: c.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: 8,
  },
  txIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  txCustomer: { fontSize: 13, fontWeight: "700", color: c.onSurface },
  txMeta: { fontSize: 10, color: c.muted, marginTop: 2 },
  txAmount: { fontSize: 13, fontWeight: "800", color: c.brandPrimary },
}));