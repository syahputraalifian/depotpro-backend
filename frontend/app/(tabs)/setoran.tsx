import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  RefreshControl,
  TextInput,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import * as authModule from "@/src/auth/AuthContext";
import * as apiModule from "@/src/api";
import * as formatModule from "@/src/format";
import * as uiModule from "@/src/ui";

const { AppButton, Badge, Field, EmptyState } = uiModule;

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

const safeShortDate = (dateStr: any) => {
  const fn = (formatModule as any)?.shortDate;
  if (typeof fn === "function") {
    try {
      return fn(dateStr);
    } catch {
      return String(dateStr || "");
    }
  }
  return String(dateStr || "");
};

export default function SetoranScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const useAuthHook = (authModule as any)?.useAuth;
  const authContext = typeof useAuthHook === "function" ? useAuthHook() : null;
  const user = authContext?.user;
  const isOwner = user?.role === "owner" || user?.role === "warehouse_admin";

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

  const [settlements, setSettlements] = useState<any[]>([]);
  const [dailySummary, setDailySummary] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [physicalCash, setPhysicalCash] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const getApi = (apiModule as any)?.api || (apiModule as any)?.default;

  const loadData = useCallback(async () => {
    try {
      if (getApi && typeof getApi.get === "function") {
        const [setRes, sumRes] = await Promise.all([
          getApi.get("/settlements").catch(() => []),
          getApi.get("/reports/daily-summary").catch(() => null),
        ]);
        setSettlements(Array.isArray(setRes) ? setRes : []);
        setDailySummary(sumRes || {});
      }
    } catch (e: any) {
      showToast(e?.message || "Gagal memuat data setoran", "error");
    }
  }, [getApi, showToast]);

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

  const expectedCash = Number(dailySummary?.cash_amount || 0);
  const physicalNum = Number(physicalCash || 0);
  const difference = physicalNum - expectedCash;

  const submitSettlement = async () => {
    if (!physicalCash) {
      showToast("Masukkan jumlah uang tunai fisik", "error");
      return;
    }

    setSubmitting(true);
    try {
      if (getApi && typeof getApi.post === "function") {
        await getApi.post("/settlements", {
          expected_amount: expectedCash,
          physical_amount: physicalNum,
          difference_amount: difference,
          note: note,
        });
      }
      showToast("Setoran kasir berhasil dikirim", "success");
      setModalOpen(false);
      setPhysicalCash("");
      setNote("");
      loadData();
    } catch (e: any) {
      showToast(e?.message || "Gagal mengirim setoran", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const approveSettlement = async (id: string) => {
    try {
      if (getApi && typeof getApi.post === "function") {
        await getApi.post(`/settlements/${id}/approve`);
      }
      showToast("Setoran diverifikasi", "success");
      loadData();
    } catch (e: any) {
      showToast(e?.message || "Gagal memverifikasi setoran", "error");
    }
  };

  const safeSettlements = Array.isArray(settlements) ? settlements : [];

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Setoran & Kas Harian</Text>
        <Pressable
          testID="create-settlement-button"
          onPress={() => setModalOpen(true)}
          style={styles.addBtn}
        >
          <Icon name="cash-outline" size={22} color={colors.onBrandPrimary} />
        </Pressable>
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
        {/* Ringkasan Kas Harian */}
        <Text style={styles.sectionTitle}>Ringkasan Kas Hari Ini</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.sLabel}>Penjualan Tunai</Text>
              <Text style={[styles.sValue, { color: colors.success }]}>
                {safeRupiah(dailySummary?.cash_amount || 0)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.sLabel}>Non-Tunai (QRIS/Tfr)</Text>
              <Text style={styles.sValue}>
                {safeRupiah(dailySummary?.non_cash_amount || 0)}
              </Text>
            </View>
          </View>
          <View style={[styles.summaryRow, { marginTop: 10 }]}>
            <View style={styles.summaryItem}>
              <Text style={styles.sLabel}>Piutang / Tempo</Text>
              <Text style={[styles.sValue, { color: colors.error }]}>
                {safeRupiah(dailySummary?.receivable_amount || 0)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.sLabel}>Total Penjualan</Text>
              <Text style={[styles.sValue, { color: colors.brandPrimary }]}>
                {safeRupiah(dailySummary?.total_sales || 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Riwayat Setoran Kasir */}
        <Text style={styles.sectionTitle}>Riwayat Setoran Kasir</Text>
        {safeSettlements.length === 0 ? (
          <EmptyState
            icon="wallet-outline"
            title="Belum Ada Setoran"
            subtitle="Buat setoran kas harian menggunakan tombol di kanan atas."
          />
        ) : (
          safeSettlements.map((s) => {
            const isApproved = s?.status === "approved";
            const diff = Number(s?.difference_amount || 0);

            return (
              <View key={s?.id || Math.random().toString()} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.kasirName}>
                      {s?.user_name || "Kasir / Kurir"}
                    </Text>
                    <Text style={styles.cardDate}>
                      {safeShortDate(s?.created_at)}
                    </Text>
                  </View>
                  <Badge
                    text={isApproved ? "Terverifikasi" : "Pending"}
                    bg={isApproved ? colors.brandTertiary : colors.surfaceTertiary}
                    fg={isApproved ? colors.onBrandTertiary : colors.muted}
                  />
                </View>

                <View style={styles.settleRow}>
                  <Text style={styles.sDetailLabel}>Estimasi Kas:</Text>
                  <Text style={styles.sDetailVal}>
                    {safeRupiah(s?.expected_amount)}
                  </Text>
                </View>

                <View style={styles.settleRow}>
                  <Text style={styles.sDetailLabel}>Setoran Fisik:</Text>
                  <Text style={[styles.sDetailVal, { fontWeight: "800" }]}>
                    {safeRupiah(s?.physical_amount)}
                  </Text>
                </View>

                {diff !== 0 && (
                  <View style={styles.settleRow}>
                    <Text style={styles.sDetailLabel}>Selisih:</Text>
                    <Text
                      style={[
                        styles.sDetailVal,
                        { color: diff < 0 ? colors.error : colors.success },
                      ]}
                    >
                      {diff > 0 ? "+" : ""}
                      {safeRupiah(diff)}
                    </Text>
                  </View>
                )}

                {s?.note ? (
                  <Text style={styles.noteText}>Catatan: {s.note}</Text>
                ) : null}

                {isOwner && !isApproved && (
                  <Pressable
                    style={styles.approveBtn}
                    onPress={() => approveSettlement(s?.id)}
                  >
                    <Text style={styles.approveBtnText}>
                      Verifikasi Setoran
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal Buat Setoran */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setModalOpen(false)}
        />
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
        >
          <Text style={styles.sheetTitle}>Form Setoran Kas Harian</Text>

          <View style={styles.calcBox}>
            <Text style={styles.calcLabel}>Estimasi Kas Tunai Sistem:</Text>
            <Text style={styles.calcVal}>{safeRupiah(expectedCash)}</Text>
          </View>

          <Field
            label="Jumlah Uang Tunai Fisik"
            value={physicalCash}
            onChangeText={setPhysicalCash}
            keyboardType="numeric"
            placeholder="0"
          />

          {physicalCash ? (
            <View style={{ marginBottom: 12 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: difference < 0 ? colors.error : colors.success,
                }}
              >
                Selisih: {difference > 0 ? "+" : ""}
                {safeRupiah(difference)}
              </Text>
            </View>
          ) : null}

          <Field
            label="Catatan Setoran"
            value={note}
            onChangeText={setNote}
            placeholder="Keterangan selisih / pecahan tunai..."
          />

          <AppButton
            title="Kirim Setoran"
            onPress={submitSettlement}
            loading={submitting}
            icon="checkmark-done-outline"
            style={{ marginTop: 8 }}
          />
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justify: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: c.brand,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  title: { color: c.onBrandPrimary, fontSize: 20, fontWeight: "800" },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: c.muted,
    marginBottom: 8,
    marginTop: 8,
  },
  summaryCard: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: 16,
  },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryItem: {
    flex: 1,
    backgroundColor: c.surfaceTertiary,
    padding: 10,
    borderRadius: 10,
  },
  sLabel: { fontSize: 11, color: c.muted },
  sValue: { fontSize: 13, fontWeight: "800", marginTop: 2, color: c.onSurface },
  card: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: c.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  kasirName: { fontSize: 14, fontWeight: "700", color: c.onSurface },
  cardDate: { fontSize: 11, color: c.muted },
  settleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sDetailLabel: { fontSize: 12, color: c.muted },
  sDetailVal: { fontSize: 12, color: c.onSurface, fontWeight: "600" },
  noteText: { fontSize: 11, color: c.muted, fontStyle: "italic", marginTop: 6 },
  approveBtn: {
    marginTop: 10,
    backgroundColor: c.brandPrimary,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  approveBtnText: {
    color: c.onBrandPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: c.onSurface,
    marginBottom: 12,
  },
  calcBox: {
    backgroundColor: c.surfaceTertiary,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  calcLabel: { fontSize: 11, color: c.muted },
  calcVal: {
    fontSize: 16,
    fontWeight: "800",
    color: c.brandPrimary,
    marginTop: 2,
  },
}));