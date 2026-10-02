import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { api } from "@/src/api";
import * as uiModule from "@/src/ui";

export default function DriverScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [userRole, setUserRole] = useState("owner");

  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    vehicle_number: "",
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

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const getApi = typeof api?.get === "function" ? api.get : null;
      if (getApi) {
        // Cek Role User Aktif dari Backend
        try {
          const profile = await getApi("/auth/me");
          if (profile && profile.role) {
            setUserRole(profile.role.toLowerCase());
          }
        } catch (e) {}

        const res = await getApi("/drivers");
        const list = Array.isArray(res) ? res : res?.data || [];
        setDrivers(list);
      }
    } catch (e) {
      console.log("Error fetching drivers:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const openAddModal = () => {
    if (userRole !== "owner") {
      showToast("Akses Ditolak: Hanya Pemilik (Owner) yang boleh menambah data driver baru");
      return;
    }
    setEditingId(null);
    setFormData({ name: "", phone: "", vehicle_number: "" });
    setModalVisible(true);
  };

  const openEditModal = (d: any) => {
    if (userRole !== "owner") {
      showToast("Akses Ditolak: Hanya Pemilik (Owner) yang boleh mengedit data driver");
      return;
    }
    const dId = typeof d === "string" ? d : d?.id || d?._id;
    setEditingId(dId);
    setFormData({
      name: d.name || "",
      phone: d.phone || "",
      vehicle_number: d.vehicle_number || "",
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showToast("Nama driver wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        vehicle_number: formData.vehicle_number.trim(),
      };

      if (editingId) {
        payload.id = editingId;
      }

      const postApi = typeof api?.post === "function" ? api.post : null;
      if (postApi) {
        await postApi("/drivers", payload);
      }

      showToast(editingId ? "Data driver diperbarui" : "Driver baru ditambahkan");
      setModalVisible(false);
      fetchDrivers();
    } catch (e: any) {
      showToast(e?.message || e?.detail || "Gagal menyimpan data driver");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDriver = async (target?: any) => {
    if (userRole !== "owner") {
      showToast("Akses Ditolak: Hanya Pemilik (Owner) yang boleh menghapus data driver");
      return;
    }

    const id = typeof target === "string" ? target : target?.id || target?._id || editingId;
    if (!id) return;

    Alert.alert(
      "Konfirmasi Hapus",
      "Apakah Anda yakin ingin menghapus data driver ini?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await api.delete(`/drivers/${id}`);
              if (response) {
                showToast("Data driver berhasil dihapus");
                setModalVisible(false);
                fetchDrivers();
              }
            } catch (e: any) {
              showToast(e?.message || e?.detail || "Gagal menghapus data driver");
            }
          },
        },
      ]
    );
  };

  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) =>
      (d.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.phone || "").includes(search)
    );
  }, [drivers, search]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manajemen Driver / Kurir</Text>
        {userRole === "owner" && (
          <Pressable onPress={openAddModal} style={styles.addHeaderBtn}>
            <Icon name="person-add" size={22} color="#fff" />
          </Pressable>
        )}
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama driver / Plat Nomor..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={colors.muted}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
          <Text style={styles.loadingText}>Memuat Data Driver...</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 100 }}>
          {filteredDrivers.map((d) => (
            <Pressable
              key={d.id || d._id || d.name}
              style={styles.card}
              onPress={() => openEditModal(d)}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{d.name}</Text>
                  <Text style={styles.cardSub}>{d.phone || "Tidak ada nomor HP"}</Text>
                </View>
                {userRole === "owner" && (
                  <Pressable onPress={() => handleDeleteDriver(d)} style={{ padding: 6 }}>
                    <Icon name="trash-outline" size={22} color="#e11d48" />
                  </Pressable>
                )}
              </View>

              <View style={styles.vehicleTag}>
                <Icon name="car-outline" size={14} color={colors.brandPrimary} />
                <Text style={styles.vehicleText}>
                  Plat: {d.vehicle_number || "Belum diisi"}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? "Edit Driver" : "Tambah Driver Baru"}
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color={colors.onSurface} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              <Text style={styles.inputLabel}>Nama Driver</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(val) => setFormData({ ...formData, name: val })}
                placeholder="Contoh: Budi Santoso"
              />

              <Text style={styles.inputLabel}>Nomor HP / WhatsApp</Text>
              <TextInput
                style={styles.input}
                keyboardType="phone-pad"
                value={formData.phone}
                onChangeText={(val) => setFormData({ ...formData, phone: val })}
                placeholder="08123456789"
              />

              <Text style={styles.inputLabel}>Plat / Nomor Kendaraan</Text>
              <TextInput
                style={styles.input}
                value={formData.vehicle_number}
                onChangeText={(val) => setFormData({ ...formData, vehicle_number: val })}
                placeholder="N 1234 ABC"
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              {editingId && userRole === "owner" && (
                <Pressable
                  style={[styles.deleteBtn, submitting && { opacity: 0.6 }]}
                  disabled={submitting}
                  onPress={() => handleDeleteDriver(editingId)}
                >
                  <Text style={styles.deleteBtnText}>Hapus Driver Ini</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.saveBtn, submitting && { opacity: 0.6 }]}
                disabled={submitting}
                onPress={handleSave}
              >
                <Text style={styles.saveBtnText}>
                  {submitting ? "Menyimpan..." : "Simpan Data"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: c.brandPrimary },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  addHeaderBtn: { padding: 4 },
  searchSection: { paddingHorizontal: 12, paddingTop: 10, backgroundColor: c.surface },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: 10, paddingHorizontal: 10, height: 40, borderWidth: 1, borderColor: c.border },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13, color: c.onSurface },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 8, fontSize: 13, color: c.muted },
  card: { backgroundColor: c.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: c.border, marginBottom: 10 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 15, fontWeight: "800", color: c.onSurface },
  cardSub: { fontSize: 12, color: c.muted, marginTop: 2 },
  vehicleTag: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.surfaceSecondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, alignSelf: "flex-start" },
  vehicleText: { fontSize: 11, fontWeight: "700", color: c.onSurface },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  modalTitle: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  inputLabel: { fontSize: 12, fontWeight: "700", color: c.onSurface, marginTop: 4 },
  input: { height: 42, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 10, color: c.onSurface, backgroundColor: c.surfaceSecondary },
  modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: c.border, gap: 8 },
  deleteBtn: { backgroundColor: "#e11d48", paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  deleteBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  saveBtn: { backgroundColor: c.brandPrimary, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
}));