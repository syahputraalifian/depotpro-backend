import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { api } from "@/src/api";

export default function LaporanScreen() {
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await api.get("/reports");
      setReports(Array.isArray(res?.data) ? res.data : []);
      setTotal(res?.daily || 0);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // FUNGSI HAPUS TRANSAKSI LAPORAN BENERAN
  const handleDeleteTx = (id: string) => {
    Alert.alert("Konfirmasi Hapus", "Hapus riwayat transaksi ini?", [
      { text: "Batal", style: "cancel" },
      {
        text: "HAPUS",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/reports/${id}`);
            fetchReports();
          } catch (e) {
            Alert.alert("Error", "Gagal menghapus transaksi");
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "#fff" }}>
      <View style={{ padding: 16, backgroundColor: "#0284c7" }}>
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>Laporan Keuangan</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ backgroundColor: "#0284c7", padding: 16, borderRadius: 12, marginBottom: 16 }}>
          <Text style={{ color: "#fff", fontSize: 12 }}>Total Omzet Real-time</Text>
          <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800" }}>Rp {total.toLocaleString("id-ID")}</Text>
        </View>

        <Text style={{ fontWeight: "800", fontSize: 15, marginBottom: 10 }}>Riwayat Penjualan</Text>

        {loading ? (
          <ActivityIndicator color="#0284c7" />
        ) : (
          reports.map((tx) => (
            <View key={tx.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, marginBottom: 8 }}>
              <View>
                <Text style={{ fontWeight: "700" }}>{tx.customer_name || "Pelanggan Umum"}</Text>
                <Text style={{ color: "#0284c7", fontWeight: "800" }}>Rp {(tx.total_amount || 0).toLocaleString("id-ID")}</Text>
              </View>
              <Pressable onPress={() => handleDeleteTx(tx.id)} style={{ padding: 6 }}>
                <Icon name="trash-outline" size={22} color="#e11d48" />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}