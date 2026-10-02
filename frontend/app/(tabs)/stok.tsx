import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Modal, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { api } from "@/src/api";

export default function StokScreen() {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    stock_filled: "0",
    stock_empty: "0",
    price_eceran: "0",
    cost_price: "0",
  });

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get("/products");
      setProducts(Array.isArray(res) ? res : []);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const openEdit = (p: any) => {
    setEditingProduct(p);
    setFormData({
      name: p.name || "",
      stock_filled: String(p.stock_filled || 0),
      stock_empty: String(p.stock_empty || 0),
      price_eceran: String(p.price_eceran || 0),
      cost_price: String(p.cost_price || 0),
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      await api.post("/products", {
        id: editingProduct?.id,
        name: formData.name,
        stock_filled: parseInt(formData.stock_filled) || 0,
        stock_empty: parseInt(formData.stock_empty) || 0,
        price_eceran: parseFloat(formData.price_eceran) || 0,
        cost_price: parseFloat(formData.cost_price) || 0,
      });
      setModalVisible(false);
      fetchProducts();
    } catch (e) {
      Alert.alert("Gagal", "Gagal menyimpan produk");
    }
  };

  // FUNGSI HAPUS BENERAN KE MONGODB
  const handleDelete = async (id: string) => {
    Alert.alert("Konfirmasi Hapus", "Yakin hapus produk ini dari database?", [
      { text: "Batal", style: "cancel" },
      {
        text: "HAPUS",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/products/${id}`);
            setModalVisible(false);
            fetchProducts();
          } catch (e) {
            Alert.alert("Error", "Gagal menghapus produk");
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "#fff" }}>
      <View style={{ padding: 16, backgroundColor: "#0284c7", flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>Stok & Gudang</Text>
        <Pressable onPress={() => { setEditingProduct(null); setModalVisible(true); }}>
          <Icon name="add-circle" size={24} color="#fff" />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0284c7" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12 }}>
          {products.map((p) => (
            <Pressable key={p.id} onPress={() => openEdit(p)} style={{ padding: 14, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", marginBottom: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 16, fontWeight: "800" }}>{p.name}</Text>
                <Pressable onPress={() => handleDelete(p.id)}>
                  <Icon name="trash-outline" size={22} color="#e11d48" />
                </Pressable>
              </View>
              <Text style={{ marginTop: 6, color: "#64748b" }}>
                Terisi: {p.stock_filled} | Kosong: {p.stock_empty}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 14, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 12 }}>
              {editingProduct ? "Edit / Hapus Produk" : "Tambah Produk"}
            </Text>

            <TextInput placeholder="Nama Produk" value={formData.name} onChangeText={(v) => setFormData({ ...formData, name: v })} style={{ borderWidth: 1, borderColor: "#cbd5e1", padding: 10, borderRadius: 8, marginBottom: 10 }} />
            <TextInput placeholder="Stok Terisi" keyboardType="numeric" value={formData.stock_filled} onChangeText={(v) => setFormData({ ...formData, stock_filled: v })} style={{ borderWidth: 1, borderColor: "#cbd5e1", padding: 10, borderRadius: 8, marginBottom: 10 }} />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              {editingProduct && (
                <Pressable onPress={() => handleDelete(editingProduct.id)} style={{ flex: 1, backgroundColor: "#e11d48", padding: 12, borderRadius: 8, alignItems: "center" }}>
                  <Text style={{ color: "#fff", fontWeight: "800" }}>HAPUS</Text>
                </Pressable>
              )}
              <Pressable onPress={handleSave} style={{ flex: 1, backgroundColor: "#0284c7", padding: 12, borderRadius: 8, alignItems: "center" }}>
                <Text style={{ color: "#fff", fontWeight: "800" }}>SIMPAN</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}