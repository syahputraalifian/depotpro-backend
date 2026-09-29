import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as themeModule from "@/src/theme";
import * as authModule from "@/src/auth/AuthContext";
import * as apiModule from "@/src/api";
import * as formatModule from "@/src/format";
import * as uiModule from "@/src/ui";

// Helper aman untuk format Rupiah (Mencegah crash 'undefined is not a function')
const safeRupiah = (val: any) => {
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

// Helper aman untuk shortDate
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

export default function Driver() {
  // Safe Theme Call
  const useThemeHook = (themeModule as any)?.useTheme;
  const theme = typeof useThemeHook === "function" ? useThemeHook() : { colors: {} };
  const colors = theme?.colors || {};

  const insets = useSafeAreaInsets();

  // Safe Auth Hook
  const useAuthHook = (authModule as any)?.useAuth;
  const authContext = typeof useAuthHook === "function" ? useAuthHook() : null;
  const user = authContext?.user;
  const isOwner = user?.role === "owner";

  // Safe Toast Helper
  const showToast = useCallback((msg: string, type?: string) => {
    try {
      const useToastHook = (uiModule as any)?.useToast;
      if (typeof useToastHook === "function") {
        const toast = useToastHook();
        if (typeof toast === "function") {
          toast(msg, type);
          return;
        } else if (toast && typeof toast.show === "function") {
          toast.show(msg, type);
          return;
        }
      }
    } catch (e) {}
    console.log(`[Toast ${type || "info"}]:`, msg);
  }, []);

  const [products, setProducts] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selDriver, setSelDriver] = useState<string>(user?.role === "driver" ? user?.id || "" : "");
  const [loads, setLoads] = useState<Record<string, { out: string; ret: string }>>({});
  const [actual, setActual] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Safe API Client
  const getApi = (apiModule as any)?.api || (apiModule as any)?.default;

  const load = useCallback(async () => {
    try {
      if (getApi && typeof getApi.get === "function") {
        const [pRes, hRes] = await Promise.all([
          getApi.get("/products").catch(() => []),
          getApi.get("/recon").catch(() => []),
        ]);
        const safeP = Array.isArray(pRes) ? pRes : [];
        const safeH = Array.isArray(hRes) ? hRes : [];

        setProducts(safeP.filter((x: any) => x && x.is_returnable));
        setHistory(safeH);

        if (isOwner) {
          const dRes = await getApi.get("/users/drivers").catch(() => []);
          setDrivers(Array.isArray(dRes) ? dRes : []);
        }
      }
    } catch (e: any) {
      showToast(e?.message || "Gagal memuat data", "error");
    }
  }, [getApi, isOwner, showToast]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const setLoad = (id: string, key: "out" | "ret", v: string) =>
    setLoads((prev) => ({ ...prev, [id]: { out: prev[id]?.out || "", ret: prev[id]?.ret || "", [key]: v } }));

  const safeProducts = Array.isArray(products) ? products : [];
  const safeHistory = Array.isArray(history) ? history : [];
  const safeDrivers = Array.isArray(drivers) ? drivers : [];

  const expected = safeProducts.reduce((s, p) => {
    if (!p) return s;
    const l = loads[p.id];
    if (!l) return s;
    const sold = Number(l.out || 0) - Number(l.ret || 0);
    return s + Math.max(sold, 0) * Number(p.price_eceran || 0);
  }, 0);

  const diff = Number(actual || 0) - expected;

  const submit = async () => {
    const driverId = isOwner ? selDriver : user?.id;
    if (!driverId) {
      showToast("Pilih driver", "error");
      return;
    }
    const payloadLoads = safeProducts
      .filter((p) => p && loads[p.id] && Number(loads[p.id].out || 0) > 0)
      .map((p) => ({
        product_id: p.id,
        name: p.name,
        price: Number(p.price_eceran || 0),
        qty_out: Number(loads[p.id].out || 0),
        qty_return: Number(loads[p.id].ret || 0),
      }));

    if (payloadLoads.length === 0) {
      showToast("Isi muatan berangkat", "error");
      return;
    }

    setSubmitting(true);
    try {
      if (getApi && typeof getApi.post === "function") {
        const res = await getApi.post("/recon", {
          driver_id: driverId,
          loads: payloadLoads,
          actual_deposit: Number(actual || 0),
        });
        const difference = res?.difference ?? 0;
        showToast(
          difference < 0 ? `Selisih kurang ${safeRupiah(Math.abs(difference))} → dicatat kasbon` : "Setoran seimbang!",
          difference < 0 ? "error" : "success"
        );
        setLoads({});
        setActual("");
        load();
      }
    } catch (e: any) {
      showToast(e?.message || "Gagal menyimpan rekonsiliasi", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const CustomBadge = ({ text, bg, fg }: any) => (
    <View style={{ backgroundColor: bg || colors.brandTertiary || "#e2e8f0", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
      <Text style={{ color: fg || colors.onBrandTertiary || "#0f172a", fontSize: 10, fontWeight: "700" }}>{text}</Text>
    </View>
  );

  const CustomField = ({ label, value, onChangeText, placeholder, keyboardType, testID }: any) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, color: colors.onSurfaceSecondary || "#475569", fontWeight: "600" }}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted || "#888"}
        keyboardType={keyboardType}
        style={{
          height: 44,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border || "#ccc",
          paddingHorizontal: 12,
          color: colors.onSurface || "#000",
          backgroundColor: colors.surfaceSecondary || "#fff",
          marginTop: 6,
        }}
      />
    </View>
  );

  const CustomButton = ({ title, onPress, style }: any) => (
    <Pressable
      onPress={onPress}
      disabled={submitting}
      style={[{ backgroundColor: colors.brandPrimary || "#007AFF", paddingVertical: 12, borderRadius: 10, alignItems: "center" }, style]}
    >
      <Text style={{ color: colors.onBrandPrimary || "#fff", fontSize: 14, fontWeight: "700" }}>
        {submitting ? "Memproses..." : title}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface || "#f8fafc" }}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 14, paddingTop: insets.top + 12, backgroundColor: colors.brand || "#2563eb", borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }}>
        <Text style={{ color: colors.onBrandPrimary || "#fff", fontSize: 20, fontWeight: "800" }}>Rekonsiliasi Driver</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        {isOwner && (
          <>
            <Text style={{ fontSize: 14, fontWeight: "800", color: colors.onSurface || "#0f172a", marginBottom: 10 }}>Pilih Driver</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
              {safeDrivers.map((d) => (
                <Pressable
                  key={d?.id || Math.random().toString()}
                  testID={`driver-${d?.id}`}
                  onPress={() => setSelDriver(d?.id)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: selDriver === d?.id ? (colors.brandPrimary || "#007AFF") : (colors.surfaceTertiary || "#f1f5f9"),
                  }}
                >
                  <Text style={{ color: selDriver === d?.id ? (colors.onBrandPrimary || "#fff") : (colors.onSurfaceTertiary || "#334155"), fontWeight: "600", fontSize: 13 }}>
                    {d?.name || "Driver"}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        <Text style={{ fontSize: 14, fontWeight: "800", color: colors.onSurface || "#0f172a", marginBottom: 10 }}>Muatan Hari Ini</Text>
        <View style={{ flexDirection: "row", paddingHorizontal: 12, marginBottom: 6 }}>
          <Text style={{ fontSize: 11, color: colors.muted || "#64748b", fontWeight: "700", flex: 2 }}>Produk</Text>
          <Text style={{ fontSize: 11, color: colors.muted || "#64748b", fontWeight: "700", flex: 1, textAlign: "center" }}>Berangkat</Text>
          <Text style={{ fontSize: 11, color: colors.muted || "#64748b", fontWeight: "700", flex: 1, textAlign: "center" }}>Kembali</Text>
        </View>

        {safeProducts.map((p) => (
          <View
            key={p?.id || Math.random().toString()}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surfaceSecondary || "#fff",
              borderRadius: 12,
              padding: 12,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: colors.border || "#e2e8f0",
              gap: 8,
            }}
          >
            <View style={{ flex: 2 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.onSurface || "#0f172a" }}>{p?.name || "Produk"}</Text>
              <Text style={{ fontSize: 11, color: colors.muted || "#64748b", marginTop: 2 }}>{safeRupiah(p?.price_eceran)}</Text>
            </View>
            <TextInput
              testID={`out-${p?.id}`}
              style={{
                flex: 1,
                backgroundColor: colors.surfaceTertiary || "#f1f5f9",
                borderRadius: 8,
                textAlign: "center",
                paddingVertical: 10,
                fontSize: 15,
                fontWeight: "700",
                color: colors.onSurface || "#0f172a",
                borderWidth: 1,
                borderColor: colors.border || "#cbd5e1",
              }}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.muted}
              value={loads[p?.id]?.out || ""}
              onChangeText={(v) => p?.id && setLoad(p.id, "out", v)}
            />
            <TextInput
              testID={`ret-${p?.id}`}
              style={{
                flex: 1,
                backgroundColor: colors.surfaceTertiary || "#f1f5f9",
                borderRadius: 8,
                textAlign: "center",
                paddingVertical: 10,
                fontSize: 15,
                fontWeight: "700",
                color: colors.onSurface || "#0f172a",
                borderWidth: 1,
                borderColor: colors.border || "#cbd5e1",
              }}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.muted}
              value={loads[p?.id]?.ret || ""}
              onChangeText={(v) => p?.id && setLoad(p.id, "ret", v)}
            />
          </View>
        ))}

        <View
          style={{
            backgroundColor: colors.surfaceSecondary || "#fff",
            borderRadius: 14,
            padding: 16,
            marginTop: 8,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.border || "#e2e8f0",
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: colors.onSurfaceSecondary || "#475569", fontWeight: "600" }}>Tagihan Setoran (otomatis)</Text>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.onSurface || "#0f172a" }}>{safeRupiah(expected)}</Text>
          </View>
          <CustomField
            label="Setoran Aktual Diterima"
            value={actual}
            onChangeText={setActual}
            keyboardType="numeric"
            placeholder="0"
            testID="actual-deposit-input"
          />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: colors.onSurfaceSecondary || "#475569", fontWeight: "600" }}>Selisih</Text>
            <Text style={{ fontSize: 18, fontWeight: "800", color: diff < 0 ? (colors.error || "#ef4444") : (colors.success || "#10b981") }}>
              {safeRupiah(diff)}
            </Text>
          </View>
          {diff < 0 && (
            <Text style={{ fontSize: 12, color: colors.error || "#ef4444", marginTop: 4 }}>
              Selisih minus akan dicatat sebagai kasbon/potongan gaji
            </Text>
          )}
        </View>

        <CustomButton title="Simpan Rekonsiliasi" onPress={submit} />

        <Text style={{ fontSize: 14, fontWeight: "800", color: colors.onSurface || "#0f172a", marginBottom: 10, marginTop: 28 }}>
          Riwayat Setoran
        </Text>
        {safeHistory.length === 0 ? (
          <View style={{ padding: 30, alignItems: "center" }}>
            <Text style={{ color: colors.muted || "#888", fontSize: 14 }}>Belum ada rekonsiliasi</Text>
          </View>
        ) : (
          safeHistory.map((h) => (
            <View
              key={h?.id || Math.random().toString()}
              style={{
                backgroundColor: colors.surfaceSecondary || "#fff",
                borderRadius: 12,
                padding: 14,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: colors.border || "#e2e8f0",
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.onSurface || "#0f172a" }}>{h?.driver_name || "Driver"}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted || "#64748b", marginTop: 2 }}>
                    {safeShortDate(h?.created_at)} • {h?.delivered_units || 0} unit terjual
                  </Text>
                </View>
                <CustomBadge
                  text={h?.status === "shortage" ? "Kurang Setor" : "Seimbang"}
                  bg={h?.status === "shortage" ? colors.receivableBadge : colors.brandTertiary}
                  fg={h?.status === "shortage" ? colors.onReceivableBadge : colors.onBrandTertiary}
                />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12, flexWrap: "wrap", gap: 6 }}>
                <Text style={{ fontSize: 11, color: colors.onSurfaceSecondary || "#475569" }}>Tagihan: {safeRupiah(h?.expected_deposit)}</Text>
                <Text style={{ fontSize: 11, color: colors.onSurfaceSecondary || "#475569" }}>Aktual: {safeRupiah(h?.actual_deposit)}</Text>
                <Text style={{ fontSize: 11, color: (h?.difference || 0) < 0 ? (colors.error || "#ef4444") : (colors.success || "#10b981"), fontWeight: "800" }}>
                  Selisih: {safeRupiah(h?.difference)}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}