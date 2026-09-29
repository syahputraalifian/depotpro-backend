import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  TextInput,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { api } from "@/src/api";
import * as formatModule from "@/src/format";
import * as uiModule from "@/src/ui";

// Initial seed produk agar layar Kasir tidak pernah kosong
const FALLBACK_PRODUCTS = [
  {
    id: "prod-1",
    name: "Gas LPG 3 Kg",
    category: "lpg",
    price_eceran: 20000,
    price: 20000,
    stock_filled: 50,
  },
  {
    id: "prod-2",
    name: "Air Galon Brand 19L",
    category: "galon_brand",
    price_eceran: 20000,
    price: 20000,
    stock_filled: 30,
  },
];

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

const extractArrayData = (res: any): any[] => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.result)) return res.result;
  if (Array.isArray(res.data?.data)) return res.data.data;
  if (Array.isArray(res.data?.result)) return res.data.result;
  return [];
};

const getProductPrice = (product: any) => {
  if (!product) return 0;
  return Number(product.price_eceran || product.price || product.cost_price || 0);
};

export default function POSScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const showToast = useCallback((msg: string) => {
    try {
      const useToastHook = (uiModule as any)?.useToast;
      if (typeof useToastHook === "function") {
        const toast = useToastHook();
        if (typeof toast === "function") {
          toast(msg);
          return;
        } else if (toast && typeof toast.show === "function") {
          toast.show(msg);
          return;
        }
      }
    } catch (e) {}
    console.log("[Toast]:", msg);
  }, []);

  const [products, setProducts] = useState<any[]>(FALLBACK_PRODUCTS);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [cart, setCart] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const getApi = typeof api?.get === "function" ? api.get : null;
      if (!getApi) return;

      const [prodRes, catRes] = await Promise.all([
        getApi("/products").catch(() => []),
        getApi("/categories").catch(() => []),
      ]);

      const safeProd = extractArrayData(prodRes);
      
      // Gabungkan data dari backend dengan data lokal/fallback
      setProducts((prev) => {
        const combined = [...prev, ...safeProd];
        const map = new Map();
        combined.forEach((item) => {
          if (item && (item.id || item.name)) {
            map.set(item.id || item.name, item);
          }
        });
        return Array.from(map.values());
      });

      const safeCat = extractArrayData(catRes);
      if (safeCat.length > 0) {
        setCategories(safeCat);
      } else {
        const currentProducts = safeProd.length > 0 ? safeProd : FALLBACK_PRODUCTS;
        const uniqueCats = Array.from(
          new Set(currentProducts.map((p) => p?.category).filter(Boolean))
        ).map((catName) => ({ id: catName, name: String(catName).toUpperCase() }));
        setCategories(uniqueCats);
      }
    } catch (e: any) {
      showToast(e?.message || "Gagal memuat produk POS");
    }
  }, [showToast]);

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

  const addToCart = (product: any) => {
    if (!product) return;
    const maxStock = Number(product.stock_filled ?? 9999);

    setCart((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const index = safePrev.findIndex((item) => item?.product?.id === product?.id || item?.product?.name === product?.name);

      if (index > -1) {
        const currentQty = safePrev[index]?.qty || 0;
        if (currentQty >= maxStock) {
          showToast(`Stok ${product.name} terbatas (${maxStock})`);
          return safePrev;
        }
        const updated = [...safePrev];
        updated[index] = {
          ...updated[index],
          qty: currentQty + 1,
        };
        return updated;
      }

      if (maxStock <= 0) {
        showToast(`Stok ${product.name} habis`);
        return safePrev;
      }

      return [...safePrev, { product, qty: 1, price: getProductPrice(product) }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      return safePrev
        .map((item) => {
          const id = item?.product?.id || item?.product?.name;
          if (id === productId) {
            const maxStock = Number(item?.product?.stock_filled ?? 9999);
            const newQty = (item?.qty || 0) + delta;

            if (newQty > maxStock) {
              showToast(`Maksimal stok tercapai (${maxStock})`);
              return item;
            }
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean);
    });
  };

  const clearCart = () => {
    setCart([]);
  };

  const safeProducts = Array.isArray(products) ? products : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeCart = Array.isArray(cart) ? cart : [];

  const filteredProducts = safeProducts.filter((p) => {
    if (!p) return false;
    const matchesSearch = (p?.name || "")
      .toLowerCase()
      .includes((search || "").toLowerCase());
      
    if (!matchesSearch) return false;

    if (selectedCategory === "all") return true;

    const cat = String(p?.category || p?.category_id || "").toLowerCase();
    const targetCat = String(selectedCategory).toLowerCase();

    if (targetCat === "lpg") return cat.includes("lpg") || cat.includes("gas");
    if (targetCat === "galon_brand") return cat.includes("galon") || cat.includes("brand") || cat.includes("air");
    if (targetCat === "refill") return cat.includes("refill") || cat.includes("ulang");

    return cat === targetCat;
  });

  const totalCartAmount = safeCart.reduce((sum, item) => {
    const price = item?.price ?? getProductPrice(item?.product);
    return sum + price * (item?.qty || 0);
  }, 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header Search */}
      <View style={styles.header}>
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari produk gas, galon, dll..."
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")}>
              <Icon name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Kategori Horizontal */}
      <View style={{ maxHeight: 50 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catScroll}
        >
          <Pressable
            style={[
              styles.catChip,
              selectedCategory === "all" && styles.catChipActive,
            ]}
            onPress={() => setSelectedCategory("all")}
          >
            <Text
              style={[
                styles.catText,
                selectedCategory === "all" && styles.catTextActive,
              ]}
            >
              Semua
            </Text>
          </Pressable>
          {safeCategories.map((cat) => {
            const catId = cat?.id || cat?.key || cat?.name;
            const isSelected = selectedCategory === catId;
            return (
              <Pressable
                key={catId || Math.random().toString()}
                style={[styles.catChip, isSelected && styles.catChipActive]}
                onPress={() => setSelectedCategory(catId)}
              >
                <Text
                  style={[styles.catText, isSelected && styles.catTextActive]}
                >
                  {cat?.name || cat?.label || "Kategori"}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Grid Produk & Panel Kasir */}
      <View style={styles.contentContainer}>
        <ScrollView
          style={styles.productGrid}
          contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brandPrimary}
            />
          }
        >
          {filteredProducts.length === 0 ? (
            <Text style={styles.emptyText}>Tidak ada produk ditemukan</Text>
          ) : (
            <View style={styles.gridRow}>
              {filteredProducts.map((p) => {
                const price = getProductPrice(p);
                const isOutOfStock = (p?.stock_filled ?? 0) <= 0;
                return (
                  <Pressable
                    key={p?.id || p?.name || Math.random().toString()}
                    style={[
                      styles.productCard,
                      isOutOfStock && { opacity: 0.6 },
                    ]}
                    onPress={() => addToCart(p)}
                  >
                    <Text style={styles.productName} numberOfLines={2}>
                      {p?.name || "Produk"}
                    </Text>
                    <Text style={styles.productPrice}>{safeRupiah(price)}</Text>
                    <Text
                      style={[
                        styles.productStock,
                        isOutOfStock && { color: colors.error },
                      ]}
                    >
                      {isOutOfStock ? "Stok Habis" : `Stok: ${p?.stock_filled ?? 0}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Panel Keranjang */}
        <View style={styles.cartPanel}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={styles.cartTitle}>Keranjang Belanja</Text>
            {safeCart.length > 0 && (
              <Pressable onPress={clearCart}>
                <Text style={{ fontSize: 11, color: colors.error, fontWeight: "600" }}>Reset</Text>
              </Pressable>
            )}
          </View>

          <ScrollView
            style={styles.cartList}
            contentContainerStyle={{ paddingBottom: 10 }}
          >
            {safeCart.length === 0 ? (
              <Text style={styles.emptyCartText}>Belum ada item dipilih</Text>
            ) : (
              safeCart.map((item, idx) => {
                const price = item?.price ?? getProductPrice(item?.product);
                const itemId = item?.product?.id || item?.product?.name;
                return (
                  <View key={itemId || idx} style={styles.cartRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cartItemName} numberOfLines={1}>
                        {item?.product?.name}
                      </Text>
                      <Text style={styles.cartItemPrice}>
                        {safeRupiah(price)}
                      </Text>
                    </View>
                    <View style={styles.qtyContainer}>
                      <Pressable
                        style={styles.qtyBtn}
                        onPress={() => updateQty(itemId, -1)}
                      >
                        <Text style={styles.qtyBtnText}>-</Text>
                      </Pressable>
                      <Text style={styles.qtyText}>{item?.qty || 0}</Text>
                      <Pressable
                        style={styles.qtyBtn}
                        onPress={() => updateQty(itemId, 1)}
                      >
                        <Text style={styles.qtyBtnText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          <View style={styles.cartFooter}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>{safeRupiah(totalCartAmount)}</Text>
            </View>
            <Pressable
              style={[
                styles.checkoutBtn,
                safeCart.length === 0 && { opacity: 0.5 },
              ]}
              disabled={safeCart.length === 0}
              onPress={() =>
                router.push({
                  pathname: "/checkout",
                  params: { cart: JSON.stringify(safeCart) },
                })
              }
            >
              <Text style={styles.checkoutText}>Proses Pembayaran</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { padding: 12, backgroundColor: c.brand, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: 10, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, marginLeft: 8, color: c.onSurface, fontSize: 14 },
  catScroll: { paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", gap: 8 },
  catChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  catChipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  catText: { fontSize: 13, color: c.muted, fontWeight: "600" },
  catTextActive: { color: c.onBrandPrimary },
  contentContainer: { flex: 1, flexDirection: "row" },
  productGrid: { flex: 1 },
  gridRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  productCard: { width: "48%", backgroundColor: c.surfaceSecondary, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: c.border, marginBottom: 8 },
  productName: { fontSize: 13, fontWeight: "700", color: c.onSurface, height: 36 },
  productPrice: { fontSize: 13, fontWeight: "800", color: c.brandPrimary, marginTop: 4 },
  productStock: { fontSize: 11, color: c.muted, marginTop: 2 },
  emptyText: { textAlign: "center", color: c.muted, marginTop: 30, fontSize: 13 },
  cartPanel: { width: "42%", backgroundColor: c.surfaceSecondary, borderLeftWidth: 1, borderLeftColor: c.border, padding: 12, display: "flex", flexDirection: "column" },
  cartTitle: { fontSize: 14, fontWeight: "800", color: c.onSurface },
  cartList: { flex: 1 },
  emptyCartText: { textAlign: "center", color: c.muted, fontSize: 12, marginTop: 20 },
  cartRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: c.border },
  cartItemName: { fontSize: 12, fontWeight: "700", color: c.onSurface },
  cartItemPrice: { fontSize: 11, color: c.muted },
  qtyContainer: { flexDirection: "row", alignItems: "center", gap: 6 },
  qtyBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  qtyBtnText: { fontWeight: "bold", fontSize: 12, color: c.brandPrimary },
  qtyText: { fontSize: 12, fontWeight: "700", color: c.onSurface, minWidth: 16, textAlign: "center" },
  cartFooter: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  totalLabel: { fontSize: 13, fontWeight: "700", color: c.muted },
  totalValue: { fontSize: 14, fontWeight: "800", color: c.onSurface },
  checkoutBtn: { backgroundColor: c.brandPrimary, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  checkoutText: { color: c.onBrandPrimary, fontSize: 13, fontWeight: "700" },
}));