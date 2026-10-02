import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { TOKEN_KEY } from "@/src/api";
import { storage } from "@/src/utils/storage";
import * as uiModule from "@/src/ui";

export default function SetoranScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

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

  const handleLogout = () => {
    Alert.alert(
      "Konfirmasi Keluar",
      "Apakah Anda yakin ingin keluar dari akun ini?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Keluar",
          style: "destructive",
          onPress: async () => {
            try {
              await storage.secureRemove(TOKEN_KEY);
              showToast("Berhasil keluar akun");
              router.replace("/login");
            } catch (e) {
              showToast("Gagal melakukan log out");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Setoran & Pengaturan</Text>
        <Pressable onPress={handleLogout} style={styles.logoutHeaderBtn}>
          <Icon name="log-out-outline" size={20} color="#fff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Manajemen Akun Sesi</Text>
          <Text style={styles.cardSub}>
            Keluar dari aplikasi untuk berpindah role (Owner, Kasir, Gudang, Driver).
          </Text>

          <Pressable style={styles.logoutCardBtn} onPress={handleLogout}>
            <Icon name="log-out-outline" size={18} color="#fff" />
            <Text style={styles.logoutCardBtnText}>Log Out (Keluar Akun)</Text>
          </Pressable>
        </View>
      </ScrollView>
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
  logoutHeaderBtn: {
    padding: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
  },
  cardTitle: { fontSize: 15, fontWeight: "800", color: c.onSurface },
  cardSub: { fontSize: 12, color: c.muted, marginTop: 4, marginBottom: 16 },
  logoutCardBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#e11d48",
    paddingVertical: 12,
    borderRadius: 10,
  },
  logoutCardBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
}));