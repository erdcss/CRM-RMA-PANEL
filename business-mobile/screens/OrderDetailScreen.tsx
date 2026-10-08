import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiFetch } from "../lib/api";
import type { AdminOrder } from "../types";
import { C, money, shortDate, statusMeta } from "../ui/theme";
import { BackHeader, Badge, EmptyState, SectionTitle } from "./common";

export function OrderDetailScreen({
  id,
  onBack,
}: {
  id: string;
  onBack: () => void;
}) {
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setOrder(await apiFetch<AdminOrder>(`/api/admin/orders/${encodeURIComponent(id)}`));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sipariş detayı alınamadı");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={C.blue} size="large" /></View>;
  }

  if (!order || error) {
    return (
      <ScrollView style={s.page} contentContainerStyle={s.content}>
        <BackHeader title="Sipariş Detayı" onBack={onBack} />
        <EmptyState title="Sipariş açılamadı" text={error || "Sipariş bulunamadı."} />
      </ScrollView>
    );
  }

  const meta = statusMeta(order.status);
  const items = Array.isArray(order.items) ? order.items : [];
  const billing = order.billing_details || {};
  const shipping = order.shipping_address || {};
  const shippingDetails = order.shipping_details || {};
  const trace = order.checkout_trace || {};

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <BackHeader
        title={order.order_number || "Sipariş Detayı"}
        subtitle={shortDate(order.created_at)}
        onBack={onBack}
      />

      <View style={s.heroCard}>
        <View>
          <Text style={s.heroLabel}>Toplam Tutar</Text>
          <Text style={s.heroValue}>{money(order.total_amount)}</Text>
        </View>
        <Badge label={meta.label} fg={meta.fg} bg={meta.bg} />
      </View>

      <SectionTitle title="Sipariş Bilgileri" />
      <InfoCard
        rows={[
          ["Sipariş no", order.order_number],
          ["Durum", meta.label],
          ["Ürün adedi", order.item_count ?? items.length],
          ["Sipariş tarihi", shortDate(order.created_at)],
          ["İptal talebi", order.cancel_requested_at ? shortDate(order.cancel_requested_at) : "Yok"],
        ]}
      />

      <SectionTitle title="Müşteri" />
      <InfoCard
        rows={[
          ["Firma", billing.companyName || "—"],
          ["Yetkili", billing.recipient || shipping.recipient || "—"],
          ["E-posta", order.customer_email || "—"],
          ["Telefon", billing.phone || shipping.phone || "—"],
          ["Vergi no", billing.taxNumber || "—"],
          ["Vergi dairesi", billing.taxOffice || "—"],
        ]}
      />

      <SectionTitle title="Teslimat Adresi" />
      <InfoCard
        rows={[
          ["Alıcı", shipping.recipient || "—"],
          ["Telefon", shipping.phone || "—"],
          ["Adres", shipping.addressLine || "—"],
          ["İlçe", shipping.district || "—"],
          ["Şehir", shipping.city || "—"],
          ["Posta kodu", shipping.postalCode || "—"],
          ["Kargo yöntemi", order.shipping_method || shipping.method || "—"],
        ]}
      />

      <SectionTitle title="Ürünler" />
      <View style={s.itemsPanel}>
        {items.length === 0 ? (
          <Text style={s.muted}>Ürün detayı bulunmuyor.</Text>
        ) : (
          items.map((item, index) => (
            <View key={String(item.productId || item.id || index)} style={s.itemRow}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={s.itemImage} resizeMode="cover" />
              ) : (
                <View style={s.itemImageFallback}><Text style={s.itemImageText}>B2B</Text></View>
              )}
              <View style={s.itemMain}>
                <Text style={s.itemName}>{item.name || item.title || "Ürün"}</Text>
                <Text style={s.itemMeta}>
                  {item.sku ? `SKU: ${item.sku} · ` : ""}
                  Adet: {item.quantity || item.qty || 1}
                </Text>
              </View>
              <View style={s.itemSide}>
                <Text style={s.itemPrice}>{money(item.total || item.totalPrice || item.price)}</Text>
                {item.price ? <Text style={s.unitPrice}>{money(item.price)} / birim</Text> : null}
              </View>
            </View>
          ))
        )}
      </View>

      <SectionTitle title="Ödeme" />
      <InfoCard
        rows={[
          ["Yöntem", order.payment_method === "bank_transfer" ? "Havale / EFT" : order.payment_method || "Kart"],
          ["Sağlayıcı", order.payment_provider || "—"],
          ["Ödeme durumu", order.payment_status || "—"],
          ["Kart", order.card_last4 ? `${order.card_association || "Kart"} •••• ${order.card_last4}` : "—"],
          ["Transfer kodu", order.transfer_code || "—"],
        ]}
      />

      <SectionTitle title="Kargo / Teslimat Detayları" />
      <ObjectCard value={shippingDetails} empty="Ek kargo detayı yok." />

      <SectionTitle title="Checkout / İşlem İzleri" />
      <ObjectCard value={trace} empty="Ek checkout detayı yok." />

      <SectionTitle title="Fatura Bilgileri" />
      <InfoCard
        rows={[
          ["Firma", billing.companyName || "—"],
          ["Vergi no", billing.taxNumber || "—"],
          ["Vergi dairesi", billing.taxOffice || "—"],
          ["Fatura adresi", billing.addressLine || "—"],
          ["İlçe / Şehir", [billing.district, billing.city].filter(Boolean).join(" / ") || "—"],
        ]}
      />
    </ScrollView>
  );
}

function InfoCard({ rows }: { rows: Array<[string, unknown]> }) {
  return (
    <View style={s.infoCard}>
      {rows.map(([label, value], index) => (
        <View key={label} style={[s.infoRow, index === rows.length - 1 && s.noBorder]}>
          <Text style={s.infoLabel}>{label}</Text>
          <Text style={s.infoValue}>{value === null || value === undefined || value === "" ? "—" : String(value)}</Text>
        </View>
      ))}
    </View>
  );
}

function ObjectCard({ value, empty }: { value: Record<string, any>; empty: string }) {
  const entries = Object.entries(value || {}).filter(([, item]) => item !== null && item !== undefined && item !== "");
  if (!entries.length) return <EmptyState title="Detay yok" text={empty} />;
  return (
    <View style={s.infoCard}>
      {entries.map(([key, value], index) => (
        <View key={key} style={[s.infoRow, index === entries.length - 1 && s.noBorder]}>
          <Text style={s.infoLabel}>{key.replace(/_/g, " ")}</Text>
          <Text style={s.infoValue} numberOfLines={3}>
            {typeof value === "object" ? JSON.stringify(value) : String(value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 36 },
  center: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  heroCard: {
    minHeight: 112,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroLabel: { color: C.muted, fontSize: 12 },
  heroValue: { color: C.text, fontSize: 29, fontWeight: "650", marginTop: 7, letterSpacing: -0.7 },
  infoCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    overflow: "hidden",
  },
  infoRow: {
    minHeight: 54,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
    flexDirection: "row",
    alignItems: "center",
  },
  noBorder: { borderBottomWidth: 0 },
  infoLabel: { width: "38%", color: C.muted, fontSize: 12, textTransform: "capitalize" },
  infoValue: { flex: 1, color: C.text, fontSize: 13, fontWeight: "500", textAlign: "right" },
  itemsPanel: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    overflow: "hidden",
  },
  itemRow: {
    minHeight: 88,
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
    flexDirection: "row",
    alignItems: "center",
  },
  itemImage: { width: 62, height: 62, borderRadius: 14, backgroundColor: C.panel2 },
  itemImageFallback: {
    width: 62,
    height: 62,
    borderRadius: 14,
    backgroundColor: C.panel2,
    alignItems: "center",
    justifyContent: "center",
  },
  itemImageText: { color: C.text2, fontSize: 10, fontWeight: "700" },
  itemMain: { flex: 1, paddingHorizontal: 12 },
  itemName: { color: C.text, fontSize: 13, fontWeight: "600" },
  itemMeta: { color: C.muted, fontSize: 10, marginTop: 5 },
  itemSide: { alignItems: "flex-end" },
  itemPrice: { color: C.text, fontSize: 13, fontWeight: "650" },
  unitPrice: { color: C.muted, fontSize: 9, marginTop: 5 },
  muted: { color: C.muted, padding: 18 },
});
