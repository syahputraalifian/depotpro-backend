import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
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

export default function DriverScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

  const fetchDeliveries = async () => {
    try {
      const getApi = typeof api?.get === "function" ? api.get : null;
      if (getApi) {
        const res = await getApi("/deliveries");
        const list = Array.isArray(res) ? res : res?.data || [];
        setDeliveries(list);
      }
    } catch (e) {
      console.log("Error fetching deliveries:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const updateStatus = async (deliveryId: string, newStatus: string) => {
    setUpdatingId(deliveryId);
    try {
      const postApi = typeof api?.post === "function" ? api.post : null;
      if (postApi) {
        await postApi(`/deliveries/${deliveryId}/status`, { status: newStatus });
      }
      showToast(`Status pengiriman diperbarui menjadi ${newStatus.toUpperCase()}`);
      fetchDeliveries();
    } catch (e: any) {
      showToast("Gagal memperbarui status pengiriman");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tugas Driver & Pengiriman</Text>
        <Pressable onPress={fetchDeliveries} style={styles.refreshBtn}>
          <Icon name="refresh" size={18} color="#fff" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={fetchDeliveries} />
          }
        >
          {deliveries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="bicycle-outline" size={44} color={colors.muted} />
              <Text style={styles.emptyText}>Tidak ada antrean pengiriman driver</Text>
            </View>
          ) : (
            deliveries.map((item, idx) => {
              const status = item.status || "pending";
              const isCompleted = status === "completed";

              return (
                <View key={item.id || idx} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.custName}>
                        {item.customer_name || "Pelanggan"}
                      </Text>
                      <Text style={styles.addressText}>
                        📍 {item.address || "Tidak ada alamat"}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        status === "completed" && { backgroundColor: "#16a34a" },
                        status === "delivering" && { backgroundColor: "#0284c7" },
                      ]}
                    >
                      <Text style={styles.statusBadgeText}>
                        {status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.itemSummary}>
                    <Text style={styles.itemSummaryText}>
                      Total Tagihan: <Text style={{ fontWeight: "800", color: colors.brandPrimary }}>{safeRupiah(item.total_amount)}</Text>
                    </Text>
                    <Text style={styles.driverText}>
                      Kurir: {item.driver_name || "Driver Depot"}
                    </Text>
                  </View>

                  {!isCompleted && (
                    <View style={styles.actionRow}>
                      {status === "pending" && (
                        <Pressable
                          style={styles.actionBtnPrimary}
                          disabled={updatingId === item.id}
                          onPress={() => updateStatus(item.id, "delivering")}
                        >
                          <Text style={styles.actionBtnText}>
                            Mulai Pengiriman
                          </Text>
                        </Pressable>
                      )}

                      {status === "delivering" && (
                        <Pressable
                          style={[styles.actionBtnPrimary, { backgroundColor: "#16a34a" }]}
                          disabled={updatingId === item.id}
                          onPress={() => updateStatus(item.id, "completed")}
                        >
                          <Text style={styles.actionBtnText}>
                            Tandai Terkirim & Potong Stok
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
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
  emptyContainer: { padding: 40, alignItems: "center" },
  emptyText: { marginTop: 8, color: c.muted, fontSize: 13 },
  card: { backgroundColor: c.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: c.border, marginBottom: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  custName: { fontSize: 15, fontWeight: "800", color: c.onSurface },
  addressText: { fontSize: 12, color: c.muted, marginTop: 4 },
  statusBadge: { backgroundColor: "#eab308", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  itemSummary: { flexDirection: "row", justifyContent: "space-between", backgroundColor: c.surfaceSecondary, padding: 10, borderRadius: 8, marginBottom: 10 },
  itemSummaryText: { fontSize: 12, color: c.onSurface },
  driverText: { fontSize: 12, color: c.muted },
  actionRow: { marginTop: 4 },
  actionBtnPrimary: { backgroundColor: c.brandPrimary, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  actionBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
}));