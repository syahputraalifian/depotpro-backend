import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
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

export default function LaporanScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportData, setReportData] = useState<any>({
    daily: 0,
    monthly: 0,
    total_transactions: 0,
    data: [],
  });

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

  const fetchReports = async () => {
    try {
      const getApi = typeof api?.get === "function" ? api.get : null;
      if (getApi) {
        const res = await getApi("/reports");
        if (res) {
          setReportData({
            daily: res.daily || 0,
            monthly: res.monthly || 0,
            total_transactions: res.total_transactions || 0,
            data: Array.isArray(res.data) ? res.data : [],
          });
        }
      }
    } catch (e) {
      console.log("Error fetching reports:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleDeleteTx = (txId: string) => {
    Alert.alert("Konfirmasi Hapus", "Hapus riwayat transaksi ini dari database?", [
      { text: "Batal", style: "cancel" },
      {
        text: "HAPUS",
        style: "destructive",
        onPress: async () => {
          try {
            const delApi = typeof api?.delete === "function" ? api.delete : null;
            if (delApi) {
              await delApi(`/reports/${txId}`);
            }
            showToast("Riwayat transaksi terhapus");
            fetchReports();
          } catch (e) {
            showToast("Gagal menghapus transaksi");
          }
        },
      },
    ]);
  };

  const transactions = Array.isArray(reportData?.data) ? reportData.data : [];

  const cashTotal = transactions
    .filter((t: any) => (t?.payment_method || "cash").toLowerCase() === "cash")
    .reduce((sum: number, t: any) => sum + (t?.total_amount || 0), 0);

  const qrisTotal = transactions
    .filter((t: any) => (t?.payment_method || "").toLowerCase() === "qris")
    .reduce((sum: number, t: any) => sum + (t?.total_amount || 0), 0);

  const transferTotal = transactions
    .filter((t: any) => (t?.payment_method || "").toLowerCase() === "transfer")
    .reduce((sum: number, t: any) => sum + (t?.total_amount || 0), 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Laporan Keuangan & Penjualan</Text>
        <Pressable onPress={fetchReports} style={styles.refreshBtn}>
          <Icon name="refresh" size={20} color="#fff" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={fetchReports} />
          }
        >
          <View style={styles.mainCard}>
            <Text style={styles.mainCardLabel}>Total Omzet Real-time</Text>
            <Text style={styles.mainCardValue}>{safeRupiah(reportData?.daily || 0)}</Text>
            <Text style={styles.mainCardSubText}>
              {reportData?.total_transactions || 0} Total Transaksi
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Rincian Metode Pembayaran</Text>
          <View style={styles.breakdownGrid}>
            <View style={styles.breakdownCard}>
              <Icon name="cash-outline" size={20} color="#16a34a" />
              <Text style={styles.breakdownLabel}>Tunai (Cash)</Text>
              <Text style={styles.breakdownValue}>{safeRupiah(cashTotal)}</Text>
            </View>

            <View style={styles.breakdownCard}>
              <Icon name="qr-code-outline" size={20} color="#0284c7" />
              <Text style={styles.breakdownLabel}>QRIS</Text>
              <Text style={styles.breakdownValue}>{safeRupiah(qrisTotal)}</Text>
            </View>

            <View style={styles.breakdownCard}>
              <Icon name="card-outline" size={20} color="#9333ea" />
              <Text style={styles.breakdownLabel}>Transfer</Text>
              <Text style={styles.breakdownValue}>{safeRupiah(transferTotal)}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Riwayat Transaksi Penjualan</Text>
          {transactions.map((tx: any, idx: number) => (
            <View key={tx?.id || idx} style={styles.txCard}>
              <View style={{ flex: 1 }}>
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
              <Pressable onPress={() => handleDeleteTx(tx.id)} style={{ paddingLeft: 12 }}>
                <Icon name="trash-outline" size={20} color="#e11d48" />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: c.brandPrimary },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  refreshBtn: { padding: 4 },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  mainCard: { backgroundColor: c.brandPrimary, borderRadius: 16, padding: 20, marginBottom: 20 },
  mainCardLabel: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" },
  mainCardValue: { color: "#fff", fontSize: 28, fontWeight: "800", marginVertical: 6 },
  mainCardSubText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: c.onSurface, marginBottom: 12, marginTop: 8 },
  breakdownGrid: { flexDirection: "row", gap: 10, marginBottom: 16 },
  breakdownCard: { flex: 1, backgroundColor: c.surfaceSecondary, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: c.border, alignItems: "flex-start" },
  breakdownLabel: { fontSize: 11, color: c.muted, marginTop: 6 },
  breakdownValue: { fontSize: 13, fontWeight: "800", color: c.onSurface, marginTop: 2 },
  emptyContainer: { padding: 30, alignItems: "center" },
  emptyText: { marginTop: 8, color: c.muted, fontSize: 13 },
  txCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: c.border, marginBottom: 8 },
  txCustomer: { fontSize: 14, fontWeight: "700", color: c.onSurface },
  txMeta: { fontSize: 11, color: c.muted, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: "800", color: c.brandPrimary },
}));