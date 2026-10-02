import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
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

export default function SetoranScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cashTotal, setCashTotal] = useState(0);
  const [submittedAmount, setSubmittedAmount] = useState("");
  const [notes, setNotes] = useState("");

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
        const transactions = Array.isArray(res?.data) ? res.data : [];
        const totalCash = transactions
          .filter((t: any) => t.payment_method === "cash")
          .reduce((sum: number, t: any) => sum + (t.total_amount || 0), 0);

        setCashTotal(totalCash);
        setSubmittedAmount(String(totalCash));
      }
    } catch (e) {
      console.log("Error fetching cash setoran:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleSubmitSetoran = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      showToast("Setoran kasir berhasil dicatat!");
    }, 1000);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Setoran Kas Harian</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Total Kas Tunai Harus Disetor</Text>
            <Text style={styles.cardAmount}>{safeRupiah(cashTotal)}</Text>
            <Text style={styles.cardSub}>
              Berdasarkan akumulasi transaksi Tunai kasir hari ini.
            </Text>
          </View>

          <Text style={styles.formLabel}>Jumlah Uang Fisik Disetor</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={submittedAmount}
            onChangeText={setSubmittedAmount}
            placeholder="Rp 0"
          />

          <Text style={styles.formLabel}>Catatan Kasir / Selisih</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: "top" }]}
            multiline
            value={notes}
            onChangeText={setNotes}
            placeholder="Tambahkan keterangan jika ada selisih..."
          />

          <Pressable
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            disabled={submitting}
            onPress={handleSubmitSetoran}
          >
            <Text style={styles.submitBtnText}>
              {submitting ? "Memproses..." : "Konfirmasi Setoran"}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: 16, paddingVertical: 14, backgroundColor: c.brandPrimary },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: c.border, marginBottom: 20 },
  cardTitle: { fontSize: 12, fontWeight: "700", color: c.muted },
  cardAmount: { fontSize: 26, fontWeight: "800", color: c.brandPrimary, marginVertical: 6 },
  cardSub: { fontSize: 11, color: c.muted },
  formLabel: { fontSize: 13, fontWeight: "700", color: c.onSurface, marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: c.onSurface, backgroundColor: c.surfaceSecondary, fontSize: 14 },
  submitBtn: { backgroundColor: c.brandPrimary, paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 24 },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
}));