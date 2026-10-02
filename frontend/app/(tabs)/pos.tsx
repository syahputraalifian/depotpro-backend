import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
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

export default function POSScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [priceType, setPriceType] = useState<"eceran" | "warung" | "pangkalan" | "korporat">("eceran");

  // Cart format: { product, qty, isExchange, price }
  const [cart, setCart] = useState<any[]>([]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const getApi = typeof api?.get === "function" ? api.get : null;
      if (getApi) {
        const res = await getApi("/products");
        const list = Array.isArray(res) ? res : res?.data || [];
        setProducts(list);
      }
    } catch (e) {
      console.log("Error fetching products:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Getting effective price based on selected price tier
  const getProductPrice = (item: any, tier: string, isExchange: boolean) => {
    let basePrice = item.price_eceran || 0;
    if (tier === "warung") basePrice = item.price_warung || basePrice;
    if (tier === "pangkalan") basePrice = item.price_pangkalan || basePrice;
    if (tier === "korporat") basePrice = item.price_korporat || basePrice;

    // Jika Beli Baru (Bukan Tukar Tabung), tambahkan Deposit Tabung
    if (!isExchange && item.deposit_amount) {
      basePrice += item.deposit_amount;
    }
    return basePrice;
  };

  const addToCart = (product: any, isExchange: boolean = true) => {
    const effectivePrice = getProductPrice(product, priceType, isExchange);
    const cartKey = `${product.id || product.name}_${isExchange ? "isi" : "baru"}`;

    setCart((prev) => {
      const existingIdx = prev.findIndex((c) => c.key === cartKey);
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx].qty += 1;
        return updated;
      }
      return [
        ...prev,
        {
          key: cartKey,
          product,
          qty: 1,
          isExchange,
          price: effectivePrice,
          priceType,
        },
      ];
    });
  };

  const updateCartQty = (key: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.key === key) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean);
    });
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = (p.name || "").toLowerCase().includes(search.toLowerCase());
      const matchCat = category === "all" || p.category === category;
      return matchSearch && matchCat;
    });
  }, [products, search, category]);

  const totalCartAmount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  }, [cart]);

  const totalCartItems = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }, [cart]);

  const proceedToCheckout = () => {
    if (cart.length === 0) return;
    router.push({
      pathname: "/checkout",
      params: { cart: JSON.stringify(cart), priceType },
    });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header & Price Tier Selector */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kasir DepotPro</Text>
        <Pressable onPress={fetchProducts} style={styles.refreshBtn}>
          <Icon name="refresh" size={18} color="#fff" />
        </Pressable>
      </View>

      {/* Selector Tipe Harga Pelanggan */}
      <View style={styles.tierContainer}>
        <Text style={styles.tierLabel}>Tipe Harga:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {[
            { id: "eceran", label: "Eceran" },
            { id: "warung", label: "Warung" },
            { id: "pangkalan", label: "Pangkalan" },
            { id: "korporat", label: "Korporat" },
          ].map((t) => (
            <Pressable
              key={t.id}
              style={[
                styles.tierChip,
                priceType === t.id && styles.tierChipActive,
              ]}
              onPress={() => setPriceType(t.id as any)}
            >
              <Text
                style={[
                  styles.tierText,
                  priceType === t.id && styles.tierTextActive,
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Filter Category & Search */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari LPG / Galon..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={colors.muted}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
          {[
            { id: "all", label: "Semua" },
            { id: "lpg", label: "LPG" },
            { id: "galon_brand", label: "Galon Brand" },
            { id: "isi_ulang", label: "Isi Ulang" },
          ].map((c) => (
            <Pressable
              key={c.id}
              style={[
                styles.catChip,
                category === c.id && styles.catChipActive,
              ]}
              onPress={() => setCategory(c.id)}
            >
              <Text style={[styles.catText, category === c.id && styles.catTextActive]}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Main Content Area */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
          <Text style={styles.loadingText}>Memuat Produk...</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 160 }}>
          <View style={styles.productGrid}>
            {filteredProducts.map((p) => {
              const currentPrice = getProductPrice(p, priceType, true);
              const newPrice = getProductPrice(p, priceType, false);

              return (
                <View key={p.id || p.name} style={styles.productCard}>
                  <Text style={styles.productName}>{p.name}</Text>
                  <Text style={styles.stockBadge}>
                    Stok: {p.stock_filled || 0} Terisi
                  </Text>

                  <View style={styles.priceContainer}>
                    <Text style={styles.priceLabel}>Isi Ulang / Tukar:</Text>
                    <Text style={styles.priceValue}>{safeRupiah(currentPrice)}</Text>
                  </View>

                  <Pressable
                    style={styles.addBtn}
                    onPress={() => addToCart(p, true)}
                  >
                    <Icon name="swap-horizontal" size={16} color="#fff" />
                    <Text style={styles.addBtnText}>+ Tukar Tabung</Text>
                  </Pressable>

                  {p.is_returnable && (
                    <Pressable
                      style={styles.addSecondaryBtn}
                      onPress={() => addToCart(p, false)}
                    >
                      <Text style={styles.addSecondaryBtnText}>
                        + Beli Baru ({safeRupiah(newPrice)})
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 && (
        <View style={[styles.cartBar, { paddingBottom: insets.bottom + 8 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cartCountText}>{totalCartItems} Item Ditemukan</Text>
            <Text style={styles.cartTotalText}>{safeRupiah(totalCartAmount)}</Text>
          </View>
          <Pressable style={styles.checkoutBtn} onPress={proceedToCheckout}>
            <Text style={styles.checkoutBtnText}>Bayar SEKARANG</Text>
            <Icon name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: c.brandPrimary },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  refreshBtn: { padding: 6 },
  tierContainer: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: c.border },
  tierLabel: { fontSize: 12, fontWeight: "700", color: c.muted, marginRight: 8 },
  tierChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tierChipActive: { backgroundColor: c.brandPrimary, borderBottomColor: c.brandPrimary },
  tierText: { fontSize: 12, fontWeight: "700", color: c.muted },
  tierTextActive: { color: "#fff" },
  searchSection: { paddingHorizontal: 12, paddingTop: 10, backgroundColor: c.surface },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: 10, paddingHorizontal: 10, height: 40, borderWidth: 1, borderColor: c.border },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13, color: c.onSurface },
  catChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  catChipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  catText: { fontSize: 12, fontWeight: "600", color: c.muted },
  catTextActive: { color: "#fff" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 8, fontSize: 13, color: c.muted },
  productGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  productCard: { width: "48%", backgroundColor: c.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: c.border, justifyContent: "space-between" },
  productName: { fontSize: 14, fontWeight: "800", color: c.onSurface },
  stockBadge: { fontSize: 11, color: c.muted, marginTop: 2, marginBottom: 8 },
  priceContainer: { marginBottom: 8 },
  priceLabel: { fontSize: 10, color: c.muted },
  priceValue: { fontSize: 15, fontWeight: "800", color: c.brandPrimary },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: c.brandPrimary, paddingVertical: 8, borderRadius: 8, gap: 4, marginBottom: 6 },
  addBtnText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  addSecondaryBtn: { alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceSecondary, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: c.border },
  addSecondaryBtnText: { color: c.onSurface, fontSize: 10, fontWeight: "700" },
  cartBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border, padding: 12, flexDirection: "row", alignItems: "center", elevation: 10, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10 },
  cartCountText: { fontSize: 11, color: c.muted },
  cartTotalText: { fontSize: 18, fontWeight: "800", color: c.brandPrimary },
  checkoutBtn: { flexDirection: "row", alignItems: "center", backgroundColor: c.brandPrimary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, gap: 6 },
  checkoutBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
}));