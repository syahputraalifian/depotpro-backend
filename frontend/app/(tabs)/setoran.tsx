import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
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

export default function SetoranScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState<any[]>([]);

  const fetchSettlements = async () => {
    setLoading(true);
    try {
      const getApi = typeof api?.get === "function" ? api.get : null;
      if (getApi) {
        const res = await getApi("/settlements");
        const list = Array.isArray(res) ? res : res?.data || [];
        setSettlements(list);
      }
    } catch (e) {
      console.log("Error fetching settlements:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettlements();
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Setoran Kasir & Driver</Text>
        <Pressable onPress={fetchSettlements} style={styles.refreshBtn}>
          <Icon name="refresh-outline" size={20} color="#fff" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
          <Text style={styles.loadingText}>Memuat Data Setoran...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 100 }}>
          {settlements.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="wallet-outline" size={48} color={colors.muted} />
              <Text style={styles.emptyText}>Belum ada riwayat setoran kasir hari ini.</Text>
            </View>
          ) : (
            settlements.map((s, idx) => (
              <View key={s.id || s._id || idx} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{s.user_name || "Kasir / Driver"}</Text>
                  <Text style={styles.cardAmount}>{safeRupiah(s.amount || 0)}</Text>
                </View>
                <Text style={styles.cardDate}>
                  Status: {(s.status || "pending").toUpperCase()} •{" "}
                  {s.created_at ? new Date(s.created_at).toLocaleString("id-ID") : "Hari Ini"}
                </Text>
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: c.brandPrimary,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  refreshBtn: { padding: 4 },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 8, fontSize: 13, color: c.muted },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingTop: 40 },
  emptyText: { marginTop: 8, fontSize: 13, color: c.muted },
  card: {
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 14, fontWeight: "800", color: c.onSurface },
  cardAmount: { fontSize: 15, fontWeight: "800", color: c.brandPrimary },
  cardDate: { fontSize: 11, color: c.muted, marginTop: 4 },
}));