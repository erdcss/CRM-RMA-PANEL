import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiFetch } from "../lib/api";
import type { B2BProduct } from "../types";
import { C, money } from "../ui/theme";
import { EmptyState, MiniStat, PageHeader } from "./common";

export function ProductsScreen() {
  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await apiFetch<B2BProduct[]>("/api/admin/b2b-products");
      setProducts(Array.isArray(result) ? result : []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ürünler alınamadı");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    if (!needle) return products;
    return products.filter((product) =>
      [product.name, product.brand, product.sku, product.barcode]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(needle),
    );
  }, [products, query]);

  const low = products.filter((product) => Number(product.stock || 0) <= Math.max(5, Number(product.units_per_box || 1))).length;
  const active = products.filter((product) => product.is_active !== false).length;

  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl
          tintColor={C.text}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
    >
      <PageHeader title="Ürünler" subtitle="Ürünleri, fiyatları ve stok durumunu yönetin." />

      <View style={s.searchBox}>
        <Text style={s.searchIcon}>⌕</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Ürün, marka, SKU veya barkod ara..."
          placeholderTextColor={C.muted}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <View style={s.stats}>
        <MiniStat icon="□" title="Toplam Ürün" value={products.length} />
        <MiniStat icon="✓" title="Aktif" value={active} accent={C.green} />
        <MiniStat icon="!" title="Düşük Stok" value={low} accent={C.orange} />
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color={C.blue} size="large" style={s.loader} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Ürün bulunamadı" text="Aramaya uygun ürün bulunmuyor." />
      ) : (
        <View style={s.list}>
          {filtered.map((product) => {
            const image =
              product.image_data ||
              (Array.isArray(product.images) && product.images.length ? product.images[0] : null);
            const lowStock = Number(product.stock || 0) <= Math.max(5, Number(product.units_per_box || 1));
            return (
              <View key={String(product.id)} style={s.card}>
                {image ? (
                  <Image source={{ uri: image }} style={s.image} resizeMode="cover" />
                ) : (
                  <View style={s.imageFallback}><Text style={s.imageText}>B2B</Text></View>
                )}
                <View style={s.main}>
                  <Text style={s.name} numberOfLines={2}>{product.name || "Ürün"}</Text>
                  <Text style={s.meta}>{[product.brand, product.sku].filter(Boolean).join(" · ") || "—"}</Text>
                  <View style={s.bottomRow}>
                    <Text style={s.price}>{money(product.price)}</Text>
                    <Text style={[s.stock, lowStock && { color: C.orange }]}>
                      Stok: {product.stock ?? 0}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 118 },
  searchBox: {
    minHeight: 56,
    marginBottom: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  searchIcon: { color: C.text2, fontSize: 24, marginRight: 10 },
  searchInput: { flex: 1, color: C.text, fontSize: 14 },
  stats: { flexDirection: "row", gap: 10, marginBottom: 18 },
  error: { color: C.red, marginBottom: 14 },
  loader: { marginTop: 30 },
  list: { gap: 10 },
  card: {
    minHeight: 108,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    flexDirection: "row",
    alignItems: "center",
  },
  image: { width: 82, height: 82, borderRadius: 17, backgroundColor: C.panel2 },
  imageFallback: {
    width: 82,
    height: 82,
    borderRadius: 17,
    backgroundColor: C.panel2,
    alignItems: "center",
    justifyContent: "center",
  },
  imageText: { color: C.text2, fontSize: 11, fontWeight: "700" },
  main: { flex: 1, paddingLeft: 13 },
  name: { color: C.text, fontSize: 14, fontWeight: "600", lineHeight: 19 },
  meta: { color: C.muted, fontSize: 10, marginTop: 5 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  price: { color: C.text, fontSize: 14, fontWeight: "650" },
  stock: { color: C.green, fontSize: 11, fontWeight: "500" },
});
