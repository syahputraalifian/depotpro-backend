import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
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

// GLOBAL IN-MEMORY CACHE (Mencegah data hilang/berubah saat pindah tab)
let dashboardCache: any = null;

export default function DashboardScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Gunakan cache sebagai initial state jika sudah ada
  const [data, setData] = useState<any>(
    dashboardCache || {
      revenue: 0,
      daily_revenue: 0,
      monthly_revenue: 0,
      transactions_count: 0,
      low_stock_count: 0,
      recent_transactions: [],
      low_stock_items: [],
    }
  );

  // Hanya tampilkan loading spinner jika BELUM ADA cache sama sekali
  const [loading, setLoading] = useState(!dashboardCache);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else if (!dashboardCache) {
      setLoading(true);
    }

    try {
      const getApi = typeof api?.get === "function" ? api.get : null;
      if (getApi) {
        const res = await getApi("/dashboard");
        if (res) {
          const formattedData = {
            revenue: res.revenue || res.daily_revenue || 0,
            daily_revenue: res.daily_revenue || res.revenue || 0,
            monthly_revenue: res.monthly_revenue || res.revenue || 0,
            transactions_count: res.transactions_count || 0,
            low_stock_count: res.low_stock_count || 0,
            recent_transactions: Array.isArray(res.recent_transactions)
              ? res.recent_transactions
              : [],
            low_stock_items: Array.isArray(res.low_stock_items)
              ? res.low_stock_items
              : [],
          };

          // Update state & simpan ke cache global
          dashboardCache = formattedData;
          setData(formattedData);
        }
      }
    } catch (e) {
      console.log("Error fetching dashboard:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Panggil data pertama kali saat komponen di-mount
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Saat tab mendapat fokus kembali, tanyakan data secara background TANPA mereset UI
  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [])
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>DepotPro ERP</Text>
          <Text style={styles.headerTitle}>Ringkasan Bisnis</Text>
        </View>
        <Pressable
          onPress={() => fetchDashboardData(true)}
          style={styles.refreshBtn}
        >
          <Icon name="refresh-outline" size={20} color="#fff" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
          <Text style={styles.loadingText}>Memuat Ringkasan Dashboard...</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchDashboardData(true)}
            />
          }
        >
          {/* Card Utama Omzet */}
          <View style={styles.mainCard}>
            <Text style={styles.mainCardLabel}>Total Penjualan / Omzet Hari Ini</Text>
            <Text style={styles.mainCardValue}>
              {safeRupiah(data.revenue || data.daily_revenue || 0)}
            </Text>

            <View style={styles.mainCardDivider} />

            <View style={styles.mainCardSubRow}>
              <View>
                <Text style={styles.mainCardSubLabel}>Total Transaksi</Text>
                <Text style={styles.mainCardSubValue}>
                  {data.transactions_count || 0} Penjualan
                </Text>
              </View>

              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.mainCardSubLabel}>Peringatan Stok Low</Text>
                <Text
                  style={[
                    styles.mainCardSubValue,
                    (data.low_stock_count || 0) > 0 && { color: "#fca5a5" },
                  ]}
                >
                  {data.low_stock_count || 0} Produk
                </Text>
              </View>
            </View>
          </View>

          {/* Metric Grid */}
          <View style={styles.gridContainer}>
            <View style={styles.gridCard}>
              <View style={[styles.gridIconBg, { backgroundColor: "#dcfce7" }]}>
                <Icon name="wallet-outline" size={20} color="#16a34a" />
              </View>
              <Text style={styles.gridLabel}>Omzet Bulanan</Text>
              <Text style={styles.gridValue}>
                {safeRupiah(data.monthly_revenue || data.revenue || 0)}
              </Text>
            </View>

            <View style={styles.gridCard}>
              <View style={[styles.gridIconBg, { backgroundColor: "#fee2e2" }]}>
                <Icon name="alert-circle-outline" size={20} color="#dc2626" />
              </View>
              <Text style={styles.gridLabel}>Stok Menipis</Text>
              <Text style={[styles.gridValue, { color: "#dc2626" }]}>
                {data.low_stock_count || 0} Item
              </Text>
            </View>
          </View>

          {/* Peringatan Produk Stok Menipis */}
          {Array.isArray(data.low_stock_items) && data.low_stock_items.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>⚠️ Perlu Reorder Stok</Text>
              {data.low_stock_items.map((item: any, idx: number) => (
                <View key={item.id || item._id || idx} style={styles.warningItemCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.warningItemTitle}>{item.name}</Text>
                    <Text style={styles.warningItemSub}>
                      Stok Kosong: {item.stock_empty || 0}
                    </Text>
                  </View>
                  <View style={styles.warningBadge}>
                    <Text style={styles.warningBadgeText}>
                      Sisa: {item.stock_filled || 0}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Transaksi Terakhir */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>🕒 Transaksi Terakhir</Text>
            {Array.isArray(data.recent_transactions) && data.recent_transactions.length > 0 ? (
              data.recent_transactions.map((tx: any, idx: number) => (
                <View key={tx.id || tx._id || idx} style={styles.txRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txCustomer}>
                      {tx.customer_name || "Pelanggan Umum"}
                    </Text>
                    <Text style={styles.txMeta}>
                      {(tx.payment_method || "cash").toUpperCase()} •{" "}
                      {tx.created_at
                        ? new Date(tx.created_at).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Baru saja"}
                    </Text>
                  </View>
                  <Text style={styles.txAmount}>
                    {safeRupiah(tx.total_amount || 0)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Belum ada riwayat transaksi hari ini.</Text>
            )}
          </View>
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
  headerGreeting: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "600" },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  refreshBtn: { padding: 6, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8 },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 8, fontSize: 13, color: c.muted },
  mainCard: {
    backgroundColor: c.brandPrimary,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  mainCardLabel: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" },
  mainCardValue: { color: "#fff", fontSize: 28, fontWeight: "800", marginVertical: 6 },
  mainCardDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginVertical: 12,
  },
  mainCardSubRow: { flexDirection: "row", justifyContent: "space-between" },
  mainCardSubLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  mainCardSubValue: { color: "#fff", fontSize: 13, fontWeight: "800", marginTop: 2 },
  gridContainer: { flexDirection: "row", gap: 10, marginBottom: 16 },
  gridCard: {
    flex: 1,
    backgroundColor: c.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  gridIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  gridLabel: { fontSize: 11, color: c.muted },
  gridValue: { fontSize: 14, fontWeight: "800", color: c.onSurface, marginTop: 2 },
  sectionContainer: { marginTop: 8, marginBottom: 12 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: c.onSurface,
    marginBottom: 10,
  },
  warningItemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff1f2",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fecdd3",
    marginBottom: 8,
  },
  warningItemTitle: { fontSize: 13, fontWeight: "700", color: "#9f1239" },
  warningItemSub: { fontSize: 11, color: "#be123c", marginTop: 2 },
  warningBadge: { backgroundColor: "#e11d48", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  warningBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  txRow: {
    flexDirection: "row",
    justify: "space-between",
    alignItems: "center",
    backgroundColor: c.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: 8,
  },
  txCustomer: { fontSize: 13, fontWeight: "700", color: c.onSurface },
  txMeta: { fontSize: 11, color: c.muted, marginTop: 2 },
  txAmount: { fontSize: 13, fontWeight: "800", color: c.brandPrimary },
  emptyText: { fontSize: 12, color: c.muted, fontStyle: "italic" },
}));