import { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { useAuth } from "@/src/auth/AuthContext";
import { api } from "@/src/api";
import { rupiah, ROLE_LABELS, timeAgo, PAYMENT_LABELS } from "@/src/format";
import { Card, Badge, useToast } from "@/src/ui";

export default function Dashboard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const router = useRouter();
  
  // Safe wrapper untuk toast agar tidak pernah "undefined is not a function"
  const toastContext = useToast();
  const showToast = typeof toastContext === "function" ? toastContext : (msg: string) => console.log("[Toast]:", msg);

  const [summary, setSummary] = useState<any>(null);
  const [assets, setAssets] = useState<any>(null);
  const [low, setLow] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const canFinance = user?.role === "owner" || user?.role === "cashier";
  const canManageStock = user?.role === "owner" || user?.role === "warehouse_admin";

  const load = useCallback(async () => {
    try {
      const [a, l, t] = await Promise.all([
        api?.get("/assets/balance").catch(() => null),
        api?.get("/inventory/low-stock").catch(() => []),
        api?.get("/transactions?limit=8").catch(() => []),
      ]);
      setAssets(a);
      setLow(Array.isArray(l) ? l : []);
      setTxns(Array.isArray(t) ? t : []);
      
      if (canFinance) {
        const sumData = await api?.get("/finance/summary").catch(() => null);
        setSummary(sumData);
      }
    } catch (e: any) {
      showToast(e?.message || "Gagal memuat data");
    }
  }, [canFinance]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const makePO = async (p: any) => {
    try {
      await api?.post("/purchase-orders", { product_id: p?.id, qty: 0 });
      showToast(`Draft PO ${p?.name || ""} dibuat`);
    } catch (e: any) {
      showToast(e?.message || "Gagal membuat PO");
    }
  };

  const safeLow = Array.isArray(low) ? low : [];
  const safeTxns = Array.isArray(txns) ? txns : [];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Halo, {user?.name || "Pengguna"} 👋</Text>
          <Text style={styles.role}>{ROLE_LABELS[user?.role || ""] || "Pemilik Depot"}</Text>
        </View>
        <Pressable testID="logout-button" onPress={signOut} style={styles.logoutBtn}>
          <Icon name="log-out-outline" size={22} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        {canFinance && summary && (
          <View style={styles.kpiGrid}>
            <Kpi label="Penjualan Hari Ini" value={rupiah(summary?.sales_today || 0)} icon="trending-up" tint={colors.brandPrimary} />
            <Kpi label="Laba Kotor Hari Ini" value={rupiah(summary?.profit_today || 0)} icon="cash-outline" tint={colors.assetGallon} />
            <Kpi label="Total Piutang" value={rupiah(summary?.total_receivable || 0)} icon="time-outline" tint={colors.warning} />
            <Kpi label="Saldo Kas" value={rupiah(summary?.cash_balance || 0)} icon="wallet-outline" tint={colors.assetRefill} />
          </View>
        )}

        {canFinance && (
          <Pressable testID="open-reports-button" onPress={() => router.push("/reports")} style={styles.reportBtn}>
            <Icon name="bar-chart" size={22} color={colors.onBrandPrimary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.reportBtnTitle}>Laporan Keuangan</Text>
              <Text style={styles.reportBtnSub}>Harian · Bulanan · Tahunan + Ekspor PDF/CSV</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        )}

        {/* Quick actions */}
        <View style={styles.quickRow}>
          {(user?.role === "owner" || user?.role === "cashier") && (
            <QuickAction icon="cart" label="Buka Kasir" onPress={() => router.push("/(tabs)/pos")} />
          )}
          {(user?.role === "owner" || user?.role === "warehouse_admin") && (
            <QuickAction icon="cube" label="Stok" onPress={() => router.push("/(tabs)/stok")} />
          )}
          {(user?.role === "owner" || user?.role === "driver") && (
            <QuickAction icon="car" label="Setoran" onPress={() => router.push("/(tabs)/driver")} />
          )}
          {(user?.role === "owner" || user?.role === "cashier") && (
            <QuickAction icon="people" label="Pelanggan" onPress={() => router.push("/(tabs)/pelanggan")} />
          )}
        </View>

        {user?.role === "owner" && (
          <View style={styles.quickRow}>
            <QuickAction icon="people-circle" label="Kelola Kurir" onPress={() => router.push("/manage-users")} />
            <QuickAction icon="settings" label="Pengaturan" onPress={() => router.push("/settings")} />
            <QuickAction icon="pricetags" label="Katalog Harga" onPress={() => router.push("/(tabs)/stok")} />
            <QuickAction icon="bar-chart" label="Laporan" onPress={() => router.push("/reports")} />
          </View>
        )}

        {/* Asset balance / Neraca Wadah */}
        {assets && (
          <Card style={{ marginTop: 4 }}>
            <Text style={styles.cardTitle}>Neraca Aset Wadah</Text>
            <Text style={styles.cardSub}>Total tabung & galon: {assets?.total_assets || 0} unit</Text>
            <View style={styles.assetRow}>
              <AssetStat label="Isi Gudang" value={assets?.filled_warehouse || 0} color={colors.brandPrimary} />
              <AssetStat label="Kosong Gudang" value={assets?.empty_warehouse || 0} color={colors.assetGallon} />
              <AssetStat label="Di Kurir" value={assets?.in_driver || 0} color={colors.assetRefill} />
              <AssetStat label="Dipinjam" value={assets?.borrowed_customers || 0} color={colors.warning} />
            </View>
          </Card>
        )}

        {/* Low stock */}
        <Card style={{ marginTop: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="alert-circle" size={18} color={colors.error} />
            <Text style={styles.cardTitle}>Stok Menipis</Text>
          </View>
          {safeLow.length === 0 ? (
            <Text style={styles.emptyLine}>Semua stok aman ✅</Text>
          ) : (
            safeLow.map((p) => {
              const critical = (p?.stock_filled ?? 0) <= 0;
              return (
                <View key={p?.id || Math.random().toString()} style={styles.lowRow}>
                  <Text style={styles.lowName}>{p?.name || "Produk"}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Badge text={critical ? "Kritis" : `Sisa ${p?.stock_filled ?? 0}`} bg={colors.receivableBadge} fg={colors.onReceivableBadge} />
                    {canManageStock && (
                      <Pressable testID={`dash-po-${p?.id}`} onPress={() => makePO(p)} style={styles.dashPoBtn}>
                        <Text style={styles.dashPoText}>Buat PO</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </Card>

        {/* Recent transactions */}
        <Card style={{ marginTop: 14 }}>
          <Text style={styles.cardTitle}>Transaksi Terbaru</Text>
          {safeTxns.length === 0 ? (
            <Text style={styles.emptyLine}>Belum ada transaksi</Text>
          ) : (
            safeTxns.map((t) => (
              <View key={t?.id || Math.random().toString()} style={styles.txnRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnName}>{t?.customer_name || "Pelanggan Umum"}</Text>
                  <Text style={styles.txnMeta}>
                    {t?.invoice_no || "-"} • {PAYMENT_LABELS[t?.payment_method] || "Tunai"} • {t?.created_at ? timeAgo(t.created_at) : "Baru saja"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.txnAmt}>{rupiah(t?.total || 0)}</Text>
                  {t?.status === "outstanding" && <Badge text="Tempo" bg={colors.depositBadge} fg={colors.onDepositBadge} />}
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

function Kpi({ label, value, icon, tint }: any) {
  const styles = useStyles();
  return (
    <View style={styles.kpiCard}>
      <Icon name={icon} size={20} color={tint} />
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress }: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={`quick-${label.toLowerCase().replace(/\s/g, "-")}`} onPress={onPress} style={styles.quickItem}>
      <View style={styles.quickIcon}>
        <Icon name={icon} size={22} color={colors.brandPrimary} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function AssetStat({ label, value, color }: any) {
  const styles = useStyles();
  return (
    <View style={styles.assetStat}>
      <Text style={[styles.assetValue, { color }]}>{value}</Text>
      <Text style={styles.assetLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16,
    backgroundColor: c.brand, borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
  },
  hello: { color: c.onBrandPrimary, fontSize: 18, fontWeight: "800" },
  role: { color: c.onBrandPrimary, opacity: 0.85, fontSize: 12, marginTop: 2 },
  logoutBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  kpiCard: {
    width: "47%", flexGrow: 1, backgroundColor: c.surfaceSecondary, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: c.border,
  },
  kpiValue: { fontSize: 18, fontWeight: "800", color: c.onSurface, marginTop: 8 },
  kpiLabel: { fontSize: 12, color: c.muted, marginTop: 2 },
  quickRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  reportBtn: { flexDirection: "row", alignItems: "center", backgroundColor: c.brand, borderRadius: 16, padding: 16, marginBottom: 16 },
  reportBtnTitle: { color: c.onBrand, fontSize: 16, fontWeight: "800" },
  reportBtnSub: { color: c.onBrand, opacity: 0.8, fontSize: 12, marginTop: 2 },
  quickItem: { alignItems: "center", flex: 1 },
  quickIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  quickLabel: { fontSize: 11, color: c.onSurfaceSecondary, fontWeight: "600" },
  cardTitle: { fontSize: 15, fontWeight: "800", color: c.onSurface },
  cardSub: { fontSize: 12, color: c.muted, marginTop: 2 },
  assetRow: { flexDirection: "row", marginTop: 14, gap: 8 },
  assetStat: { flex: 1, alignItems: "center", backgroundColor: c.surfaceTertiary, borderRadius: 12, paddingVertical: 12 },
  assetValue: { fontSize: 20, fontWeight: "800" },
  assetLabel: { fontSize: 10, color: c.muted, marginTop: 4, textAlign: "center" },
  emptyLine: { color: c.muted, fontSize: 13, marginTop: 10 },
  lowRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  lowName: { color: c.onSurface, fontSize: 14, fontWeight: "600", flex: 1 },
  dashPoBtn: { backgroundColor: c.brandPrimary, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  dashPoText: { color: c.onBrandPrimary, fontSize: 11, fontWeight: "700" },
  txnRow: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 8 },
  txnName: { color: c.onSurface, fontSize: 14, fontWeight: "700" },
  txnMeta: { color: c.muted, fontSize: 11, marginTop: 2 },
  txnAmt: { color: c.onSurface, fontSize: 14, fontWeight: "800" },
}));