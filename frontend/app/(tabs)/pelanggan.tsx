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

const TIER_OPTIONS = [
  { id: "semua", label: "Semua" },
  { id: "pangkalan", label: "Pangkalan" },
  { id: "warung", label: "Warung" },
  { id: "korporat", label: "Korporat" },
  { id: "eceran", label: "Eceran" },
];

export default function PelangganScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTab, setSelectedTab] = useState("semua");

  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    tier: "eceran",
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

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const getApi = typeof api?.get === "function" ? api.get : null;
      if (getApi) {
        const res = await getApi("/customers");
        const list = Array.isArray(res) ? res : res?.data || [];
        setCustomers(list);
      }
    } catch (e) {
      console.log("Error fetching customers:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ name: "", phone: "", address: "", tier: "eceran" });
    setModalVisible(true);
  };

  const openEditModal = (c: any) => {
    const cId = typeof c === "string" ? c : c?.id || c?._id;
    setEditingId(cId);
    setFormData({
      name: c.name || "",
      phone: c.phone || "",
      address: c.address || "",
      tier: c.tier || c.type || "eceran",
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showToast("Nama pelanggan wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        tier: formData.tier,
        type: formData.tier,
      };

      if (editingId) {
        payload.id = editingId;
      }

      const postApi = typeof api?.post === "function" ? api.post : null;
      if (postApi) {
        await postApi("/customers", payload);
      }

      showToast(editingId ? "Data pelanggan diperbarui" : "Pelanggan baru ditambahkan");
      setModalVisible(false);
      fetchCustomers();
    } catch (e: any) {
      showToast(e?.message || e?.detail || "Gagal menyimpan data pelanggan");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (target?: any) => {
    const id = typeof target === "string" ? target : target?.id || target?._id || editingId;
    if (!id) return;

    Alert.alert(
      "Konfirmasi Hapus",
      "Apakah Anda yakin ingin menghapus data pelanggan ini?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await api.delete(`/customers/${id}`);
              if (response) {
                showToast("Data pelanggan berhasil dihapus");
                setModalVisible(false);
                fetchCustomers();
              }
            } catch (e: any) {
              showToast(e?.message || e?.detail || "Gagal menghapus data pelanggan");
            }
          },
        },
      ]
    );
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.phone || "").includes(search);

      const customerTier = (c.tier || c.type || "eceran").toLowerCase();
      const matchesTab =
        selectedTab === "semua" || customerTier === selectedTab.toLowerCase();

      return matchesSearch && matchesTab;
    });
  }, [customers, search, selectedTab]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header Utama */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manajemen Pelanggan</Text>
        <Pressable onPress={openAddModal} style={styles.addHeaderBtn}>
          <Icon name="person-add" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* Bar Pencarian */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari pelanggan / nomor HP..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={colors.muted}
          />
        </View>
      </View>

      {/* Filter Tab Kategori Pelanggan */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {TIER_OPTIONS.map((tab) => {
            const active = selectedTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setSelectedTab(tab.id)}
                style={[styles.tabChip, active && styles.tabChipActive]}
              >
                <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
          <Text style={styles.loadingText}>Memuat Data Pelanggan...</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 100 }}>
          {filteredCustomers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="people-outline" size={48} color={colors.muted} />
              <Text style={styles.emptyText}>Tidak ada data pelanggan untuk kategori ini.</Text>
            </View>
          ) : (
            filteredCustomers.map((c) => (
              <Pressable
                key={c.id || c._id || c.name}
                style={styles.card}
                onPress={() => openEditModal(c)}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{c.name}</Text>
                    <Text style={styles.cardSub}>{c.phone || "Tidak ada nomor HP"}</Text>
                  </View>
                  <Pressable onPress={() => handleDeleteCustomer(c)} style={{ padding: 6 }}>
                    <Icon name="trash-outline" size={22} color="#e11d48" />
                  </Pressable>
                </View>

                {c.address ? <Text style={styles.addressText}>{c.address}</Text> : null}

                <View style={styles.cardFooter}>
                  <View style={styles.tierTag}>
                    <Text style={styles.tierText}>
                      Tipe: {(c.tier || c.type || "eceran").toUpperCase()}
                    </Text>
                  </View>
                  {c.credit_limit ? (
                    <Text style={styles.creditText}>
                      Limit: Rp {Number(c.credit_limit).toLocaleString("id-ID")}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      {/* Modal Form Tambah / Edit */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? "Edit Pelanggan" : "Tambah Pelanggan Baru"}
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color={colors.onSurface} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              <Text style={styles.inputLabel}>Nama Pelanggan</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(val) => setFormData({ ...formData, name: val })}
                placeholder="Contoh: Toko Berkah / Pak Ahmad"
              />

              <Text style={styles.inputLabel}>Nomor HP / WhatsApp</Text>
              <TextInput
                style={styles.input}
                keyboardType="phone-pad"
                value={formData.phone}
                onChangeText={(val) => setFormData({ ...formData, phone: val })}
                placeholder="08123456789"
              />

              <Text style={styles.inputLabel}>Tipe Kategori Pelanggan</Text>
              <View style={styles.tierOptionRow}>
                {TIER_OPTIONS.filter((t) => t.id !== "semua").map((opt) => {
                  const isSelected = formData.tier === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => setFormData({ ...formData, tier: opt.id })}
                      style={[styles.tierSelectChip, isSelected && styles.tierSelectChipActive]}
                    >
                      <Text style={[styles.tierSelectText, isSelected && styles.tierSelectTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Alamat Lengkap</Text>
              <TextInput
                style={[styles.input, { height: 70 }]}
                multiline
                value={formData.address}
                onChangeText={(val) => setFormData({ ...formData, address: val })}
                placeholder="Alamat pengiriman depot"
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              {editingId && (
                <Pressable
                  style={[styles.deleteBtn, submitting && { opacity: 0.6 }]}
                  disabled={submitting}
                  onPress={() => handleDeleteCustomer(editingId)}
                >
                  <Text style={styles.deleteBtnText}>Hapus Pelanggan Ini</Text>
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
  tabContainer: { paddingVertical: 10, backgroundColor: c.surface },
  tabScroll: { paddingHorizontal: 12, gap: 8 },
  tabChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  tabChipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  tabChipText: { fontSize: 12, fontWeight: "600", color: c.onSurface },
  tabChipTextActive: { color: "#fff", fontWeight: "800" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 8, fontSize: 13, color: c.muted },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingTop: 40 },
  emptyText: { marginTop: 8, fontSize: 13, color: c.muted },
  card: { backgroundColor: c.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: c.border, marginBottom: 10 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 15, fontWeight: "800", color: c.onSurface },
  cardSub: { fontSize: 12, color: c.muted, marginTop: 2 },
  addressText: { fontSize: 12, color: c.onSurface, marginTop: 8 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  tierTag: { backgroundColor: c.surfaceSecondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  tierText: { fontSize: 10, fontWeight: "700", color: c.brandPrimary },
  creditText: { fontSize: 11, color: c.muted, fontWeight: "600" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  modalTitle: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  inputLabel: { fontSize: 12, fontWeight: "700", color: c.onSurface, marginTop: 4 },
  input: { height: 42, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 10, color: c.onSurface, backgroundColor: c.surfaceSecondary },
  tierOptionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  tierSelectChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary },
  tierSelectChipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  tierSelectText: { fontSize: 12, color: c.onSurface, fontWeight: "600" },
  tierSelectTextActive: { color: "#fff", fontWeight: "800" },
  modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: c.border, gap: 8 },
  deleteBtn: { backgroundColor: "#e11d48", paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  deleteBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  saveBtn: { backgroundColor: c.brandPrimary, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
}));