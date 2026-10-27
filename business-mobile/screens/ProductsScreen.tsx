import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../lib/api";
import type { B2BProduct } from "../types";
import { C } from "../ui/theme";
import { isLowStock, ProductCard } from "./ProductCard";
import { EmptyState, MiniStat, PageHeader } from "./common";

export function ProductsScreen({ onAdd, onAiAdd, onEdit }: { onAdd: () => void; onAiAdd?: () => void; onEdit: (id: string) => void }) {
  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "low">("all");
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
    return products.filter((product) => {
      if (filter === "low" && (product.is_active === false || !isLowStock(product))) return false;
      return !needle || [product.name, product.brand, product.sku, product.barcode]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(needle);
    });
  }, [products, query, filter]);

  const low = products.filter((product) => product.is_active !== false && isLowStock(product)).length;
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
      <PageHeader
        title="Ürünler"
        subtitle="Ürünleri, fiyatları ve stok durumunu yönetin."
      />

      <View style={s.actions}>
        {onAiAdd ? (
          <TouchableOpacity
            style={s.aiEntry}
            onPress={onAiAdd}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="AI ile Ürün Ekle"
            accessibilityHint="Fotoğraf analizi ve ürün önizleme ekranını açar"
          >
            <View style={s.aiIcon}><Ionicons name="sparkles" size={25} color="#B3D4FF" /></View>
            <View style={s.aiCopy}>
              <Text style={s.aiEyebrow}>ÇALIŞKAN BUSINESS · AI STUDIO</Text>
              <Text style={s.aiTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>AI ile Ürün Ekle</Text>
              <Text style={s.aiSubtitle}>Görsel analizi · zorunlu alanlar · önizleme</Text>
            </View>
            <Ionicons name="arrow-forward-circle" size={27} color="#8FBFFF" />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={s.manualAction}
          onPress={onAdd}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel="Manuel Ürün Ekle"
        >
          <Ionicons name="add-circle-outline" size={18} color="#CEDFF7" />
          <Text style={s.manualText}>Manuel Ürün Ekle</Text>
          <Ionicons name="chevron-forward" size={14} color="#7E8998" />
        </TouchableOpacity>
      </View>

      <View style={s.searchBox}>
        <Ionicons name="search-outline" size={22} color={C.text2} style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          placeholder="Ürün, marka, SKU veya barkod ara..."
          placeholderTextColor={C.muted}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <View style={s.stats}>
        <MiniStat icon="▣" title="Toplam Ürün" value={products.length} />
        <MiniStat icon="✓" title="Aktif" value={active} accent={C.green} />
        <MiniStat icon="!" title="Düşük Stok" value={low} accent={C.orange} />
      </View>

      <View style={s.filters}>
        <TouchableOpacity onPress={() => setFilter("all")} style={[s.filterButton, filter === "all" && s.filterActive]} accessibilityRole="button" accessibilityState={{ selected: filter === "all" }}>
          <Ionicons name="grid-outline" size={16} color={filter === "all" ? C.text : C.muted} />
          <Text style={[s.filterText, filter === "all" && s.filterTextActive]}>Tüm ürünler</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setFilter("low")} style={[s.filterButton, filter === "low" && s.filterActive]} accessibilityRole="button" accessibilityState={{ selected: filter === "low" }}>
          <Ionicons name="alert-circle-outline" size={16} color={filter === "low" ? C.orange : C.muted} />
          <Text style={[s.filterText, filter === "low" && s.filterTextActive]}>Düşük stok ({low})</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color={C.blue} size="large" style={s.loader} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Ürün bulunamadı" text="Aramaya uygun ürün bulunmuyor." />
      ) : (
        <View style={s.list}>
          {filtered.map((product) => (
            <ProductCard key={String(product.id)} product={product} onPress={() => onEdit(String(product.id))} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  actions: { marginBottom: 17, gap: 10 },
  aiEntry: {
    flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 21, padding: 15,
    borderWidth: 1, borderColor: "rgba(105,166,255,0.55)", backgroundColor: "#112741",
    minHeight: 90,
  },
  aiIcon: {
    width: 49, height: 49, borderRadius: 15, backgroundColor: "rgba(59,130,246,0.24)",
    borderWidth: 1, borderColor: "rgba(126,181,255,0.28)",
    alignItems: "center", justifyContent: "center",
  },
  aiCopy: { flex: 1, minWidth: 0 },
  aiEyebrow: { fontSize: 9, fontWeight: "800", color: "#9EC4FF", letterSpacing: 0.45 },
  aiTitle: { fontSize: 18, fontWeight: "900", color: "#FFFFFF", marginTop: 5 },
  aiSubtitle: { fontSize: 10, color: "#B9CCDE", lineHeight: 15, marginTop: 5 },
  manualAction: {
    minHeight: 47, borderRadius: 15, borderWidth: 1, borderColor: C.line,
    backgroundColor: C.panel2, flexDirection: "row", gap: 8,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 14,
  },
  manualText: { color: "#C9DBF2", fontSize: 12, fontWeight: "700" },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 136 },
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
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: C.text, fontSize: 14 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  filters: { flexDirection: "row", gap: 10, marginBottom: 16 },
  filterButton: { flex: 1, minHeight: 42, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderColor: C.line, borderWidth: 1, backgroundColor: C.panel },
  filterActive: { borderColor: C.blue, backgroundColor: C.blueSoft },
  filterText: { color: C.muted, fontSize: 12, fontWeight: "600" },
  filterTextActive: { color: C.text },
  error: { color: C.red, marginBottom: 14 },
  loader: { marginTop: 30 },
  list: { gap: 10 },
});
