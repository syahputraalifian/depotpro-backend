import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { api } from "@/src/api";
import * as uiModule from "@/src/ui";

export default function PelangganScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    type: "eceran",
    gallon_deposit_qty: "0",
    lpg_deposit_qty: "0",
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
    setFormData({
      name: "",
      phone: "",
      address: "",
      type: "eceran",
      gallon_deposit_qty: "0",
      lpg_deposit_qty: "0",
    });
    setModalVisible(true);
  };

  const openEditModal = (c: any) => {
    setEditingId(c.id);
    setFormData({
      name: c.name || "",
      phone: c.phone || "",
      address: c.address || "",
      type: c.type || "eceran",
      gallon_deposit_qty: String(c.gallon_deposit_qty || 0),
      lpg_deposit_qty: String(c.lpg_deposit_qty || 0),
    });
    setModalVisible(true);
  };

  const handleSaveCustomer = async () => {
    if (!formData.name.trim()) {
      showToast("Nama pelanggan wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        id: editingId || undefined,
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        type: formData.type,
        gallon_deposit_qty: parseInt(formData.gallon_deposit_qty) || 0,
        lpg_deposit_qty: parseInt(formData.lpg_deposit_qty) || 0,
      };

      const postApi = typeof api?.post === "function" ? api.post : null;
      if (postApi) {
        await postApi("/customers", payload);
      }

      showToast(editingId ? "Pelanggan diperbarui!" : "Pelanggan disimpan!");
      setModalVisible(false);
      fetchCustomers();
    } catch (e: any) {
      showToast("Gagal menyimpan pelanggan");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    setSubmitting(true);
    try {
      const delApi = typeof api?.delete === "function" ? api.delete : null;
      if (delApi) await delApi(`/customers/${id}`);
      showToast("Pelanggan berhasil dihapus");
      setModalVisible(false);
      fetchCustomers();
    } catch (e) {
      showToast("Gagal menghapus pelanggan");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCustomers = customers.filter((c) =>
    (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.address || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manajemen Pelanggan</Text>
        <Pressable onPress={openAddModal} style={styles.addBtn}>
          <Icon name="person-add" size={20} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari pelanggan / alamat..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={colors.muted}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 100 }}>
          {filteredCustomers.map((c, idx) => (
            <Pressable key={c.id || idx} style={styles.card} onPress={() => openEditModal(c)}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.custName}>{c.name}</Text>
                  <Text style={styles.custMeta}>
                    📞 {c.phone || "-"} | 📍 {c.address || "Tidak ada alamat"}
                  </Text>
                </View>
                <View style={styles.typeTag}>
                  <Text style={styles.typeTagText}>
                    {(c.type || "Eceran").toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.depositRow}>
                <Text style={styles.depositText}>
                  Galon Dipinjam: <Text style={{ fontWeight: "800", color: colors.brandPrimary }}>{c.gallon_deposit_qty || 0}</Text>
                </Text>
                <Text style={styles.depositText}>
                  Tabung LPG Dipinjam: <Text style={{ fontWeight: "800", color: colors.brandPrimary }}>{c.lpg_deposit_qty || 0}</Text>
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
                {editingId ? "Edit Pelanggan" : "Tambah Pelanggan Baru"}
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Icon name="close" size={22} color={colors.onSurface} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
              <Text style={styles.inputLabel}>Nama Pelanggan</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(val) => setFormData({ ...formData, name: val })}
                placeholder="Nama Toko / Perorangan"
              />

              <Text style={styles.inputLabel}>Nomor WhatsApp/Telepon</Text>
              <TextInput
                style={styles.input}
                keyboardType="phone-pad"
                value={formData.phone}
                onChangeText={(val) => setFormData({ ...formData, phone: val })}
                placeholder="08123456789"
              />

              <Text style={styles.inputLabel}>Alamat Lengkap</Text>
              <TextInput
                style={styles.input}
                value={formData.address}
                onChangeText={(val) => setFormData({ ...formData, address: val })}
                placeholder="Jalan, RT/RW, No. Rumah"
              />

              <Text style={styles.inputLabel}>Kategori Tipe Pelanggan</Text>
              <View style={styles.typeSelector}>
                {["eceran", "warung", "pangkalan", "korporat"].map((t) => (
                  <Pressable
                    key={t}
                    style={[
                      styles.typeChip,
                      formData.type === t && styles.typeChipActive,
                    ]}
                    onPress={() => setFormData({ ...formData, type: t })}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        formData.type === t && styles.typeChipTextActive,
                      ]}
                    >
                      {t.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Pinjaman Galon</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={formData.gallon_deposit_qty}
                    onChangeText={(val) => setFormData({ ...formData, gallon_deposit_qty: val })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Pinjaman LPG</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={formData.lpg_deposit_qty}
                    onChangeText={(val) => setFormData({ ...formData, lpg_deposit_qty: val })}
                  />
                </View>
              </View>
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
                onPress={handleSaveCustomer}
              >
                <Text style={styles.saveBtnText}>
                  {submitting ? "Memproses..." : "Simpan Pelanggan"}
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
  addBtn: { padding: 4 },
  searchSection: { padding: 12, backgroundColor: c.surface },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: 10, paddingHorizontal: 10, height: 40, borderWidth: 1, borderColor: c.border },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13, color: c.onSurface },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { backgroundColor: c.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: c.border, marginBottom: 10 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  custName: { fontSize: 15, fontWeight: "800", color: c.onSurface },
  custMeta: { fontSize: 12, color: c.muted, marginTop: 4 },
  typeTag: { backgroundColor: c.brandPrimary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  typeTagText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  depositRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: c.surfaceSecondary, padding: 8, borderRadius: 8 },
  depositText: { fontSize: 11, color: c.muted },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  modalTitle: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  inputLabel: { fontSize: 12, fontWeight: "700", color: c.onSurface, marginTop: 4 },
  input: { height: 42, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 10, color: c.onSurface, backgroundColor: c.surfaceSecondary },
  typeSelector: { flexDirection: "row", gap: 6, marginVertical: 4 },
  typeChip: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: c.border, alignItems: "center", backgroundColor: c.surfaceSecondary },
  typeChipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  typeChipText: { fontSize: 10, fontWeight: "700", color: c.muted },
  typeChipTextActive: { color: "#fff" },
  modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: c.border, gap: 8 },
  deleteBtn: { backgroundColor: "#e11d48", paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  deleteBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  saveBtn: { backgroundColor: c.brandPrimary, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
}));