import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../lib/api";
import type { B2BProduct } from "../types";
import { C } from "../ui/theme";
import { BackHeader, EmptyState } from "./common";
import { isLowStock, ProductCard } from "./ProductCard";

export function LowStockScreen({
  onBack, onEdit, onProducts,
}: {
  onBack: () => void;
  onEdit: (id: string) => void;
  onProducts: () => void;
}) {
  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await apiFetch<B2BProduct[]>("/api/admin/b2b-products");
      setProducts(Array.isArray(response) ? response : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Stok bilgileri yüklenemedi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const critical = useMemo(
    () => products.filter((p) => p.is_active !== false && isLowStock(p))
      .sort((a, b) => Number(a.stock ?? 0) - Number(b.stock ?? 0)),
    [products],
  );
  const outOfStock = critical.filter((p) => Number(p.stock ?? 0) <= 0).length;

  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl tintColor={C.text} refreshing={refreshing} onRefresh={() => {
        setRefreshing(true);
        void load();
      }} />}
    >
      <BackHeader title="Düşük Stok" subtitle="Yeniden tedarik edilmesi gereken ürünler" onBack={onBack} />
      <View style={s.summary}>
        <View style={s.summaryIcon}><Ionicons name="alert-circle-outline" size={27} color={C.orange} /></View>
        <View style={s.summaryText}>
          <Text style={s.total}>{critical.length} kritik ürün</Text>
          <Text style={s.info}>{outOfStock} ürünün stoğu tükenmiş. Kartlara dokunarak stok düzenleyebilirsiniz.</Text>
        </View>
      </View>
      <TouchableOpacity style={s.allButton} onPress={onProducts} accessibilityRole="button">
        <Text style={s.allText}>Tüm ürünlere git</Text>
        <Ionicons name="arrow-forward" color={C.text2} size={17} />
      </TouchableOpacity>
      {error ? <Text style={s.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={C.blue} size="large" style={s.loader} /> : null}
      {!loading && !error && critical.length === 0
        ? <EmptyState title="Kritik stok yok" text="Düşük stok seviyesinde ürün bulunamadı." />
        : <View style={s.list}>
            {critical.map((product) => (
              <ProductCard key={String(product.id)} product={product} onPress={() => onEdit(String(product.id))} />
            ))}
          </View>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 48 },
  summary: {
    minHeight: 108, borderRadius: 22, padding: 17, backgroundColor: C.panel,
    borderWidth: 1, borderColor: C.line, flexDirection: "row", alignItems: "center", gap: 13,
  },
  summaryIcon: { width: 54, height: 54, borderRadius: 17, backgroundColor: C.orangeSoft, alignItems: "center", justifyContent: "center" },
  summaryText: { flex: 1, minWidth: 0 },
  total: { fontSize: 21, fontWeight: "700", color: C.text },
  info: { fontSize: 12, color: C.text2, lineHeight: 18, marginTop: 5 },
  allButton: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 18, marginBottom: 19, paddingHorizontal: 15, height: 47,
    borderWidth: 1, borderColor: C.line, borderRadius: 15, backgroundColor: C.panel2,
  },
  allText: { color: C.text2, fontWeight: "600", fontSize: 13 },
  error: { color: C.red, marginBottom: 12 },
  loader: { marginTop: 26 },
  list: { gap: 10 },
});
