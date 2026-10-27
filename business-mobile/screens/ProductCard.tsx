import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { B2BProduct } from "../types";
import { C, money } from "../ui/theme";

export function isLowStock(product: B2BProduct): boolean {
  const stock = Number(product.stock ?? 0);
  const threshold = Math.max(5, Number(product.units_per_box || 1));
  return Number.isFinite(stock) && stock <= threshold;
}

export function productImage(product: B2BProduct): string | null {
  // Existing rows may contain a JSON string rather than a parsed JSONB array.
  const raw: unknown = product.images;
  let images: unknown = raw;
  if (typeof raw === "string") {
    try { images = JSON.parse(raw); } catch { images = []; }
  }
  const first = Array.isArray(images)
    ? images.find((image): image is string => typeof image === "string" && image.trim().length > 0)
    : null;
  const candidate = first || product.image_data;
  if (typeof candidate !== "string") return null;
  const url = candidate.trim();
  return /^(https?:\/\/|data:image\/)/i.test(url) ? url : null;
}

export function ProductCard({
  product,
  onPress,
}: {
  product: B2BProduct;
  onPress: () => void;
}) {
  const uri = productImage(product);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [uri]);
  const low = isLowStock(product);
  const stock = Number(product.stock ?? 0);
  return (
    <TouchableOpacity
      style={s.card}
      onPress={onPress}
      activeOpacity={0.76}
      accessibilityRole="button"
      accessibilityLabel={(product.name || "Ürün") + ", düzenle"}
      accessibilityHint="Ürün bilgilerini ve görsellerini düzenleme ekranında açar"
    >
      <View style={s.imageBox}>
        {uri && !imageFailed ? (
          <Image source={{ uri }} style={s.image} resizeMode="contain" onError={() => setImageFailed(true)} />
        ) : (
          <Ionicons name="cube-outline" size={32} color={C.muted} />
        )}
      </View>
      <View style={s.main}>
        <Text numberOfLines={2} style={s.name}>{product.name || "İsimsiz ürün"}</Text>
        <Text numberOfLines={1} style={s.meta}>
          {[product.brand, product.sku].filter(Boolean).join(" · ") || "Stok kodu bulunmuyor"}
        </Text>
        <View style={s.infoRow}>
          <Text style={s.price} numberOfLines={1}>{money(product.price)}</Text>
          <View style={[s.stockChip, low ? s.stockChipLow : s.stockChipNormal]}>
            <Ionicons name={low ? "alert-circle-outline" : "checkmark-circle-outline"} size={12} color={low ? C.orange : C.green} />
            <Text style={[s.stockText, { color: low ? C.orange : C.green }]}>
              {stock <= 0 ? "Stok tükendi" : "Stok: " + stock}
            </Text>
          </View>
        </View>
      </View>
      <View style={s.edit}>
        <Ionicons name="create-outline" size={19} color="#A9C7F8" />
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    minHeight: 124, padding: 12, borderRadius: 20, borderWidth: 1,
    borderColor: C.line, backgroundColor: C.panel,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  imageBox: {
    width: 88, height: 96, borderRadius: 16, backgroundColor: "#F7F8FA",
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  main: { flex: 1, minWidth: 0, justifyContent: "center" },
  name: { color: C.text, fontSize: 14, fontWeight: "700", lineHeight: 19 },
  meta: { color: C.muted, fontSize: 11, marginTop: 7 },
  infoRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7, marginTop: 11 },
  price: { color: C.text, fontSize: 14, fontWeight: "700" },
  stockChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9 },
  stockChipLow: { backgroundColor: C.orangeSoft },
  stockChipNormal: { backgroundColor: C.greenSoft },
  stockText: { fontWeight: "600", fontSize: 10 },
  edit: { alignSelf: "flex-start", padding: 5, borderRadius: 10, backgroundColor: C.blueSoft },
});
