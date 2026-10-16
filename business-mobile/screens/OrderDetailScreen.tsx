import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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
  const [bankChecked, setBankChecked] = useState(false);
  const [bankBusy, setBankBusy] = useState(false);
  const [bankNotice, setBankNotice] = useState("");

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

  async function approveBankPayment() {
    if (!bankChecked || bankBusy || !order) return;
    setBankBusy(true);
    setBankNotice("");
    try {
      const response = await apiFetch<{ok:boolean;notificationRecorded:boolean}>(
        `/api/admin/orders/${encodeURIComponent(id)}/approve-bank-payment`, {
          method: "POST", body: JSON.stringify({bankStatementChecked:true}),
        },
      );
      await load();
      setBankChecked(false);
      setBankNotice(response.notificationRecorded
        ? "Ödeme onaylandı. Müşterinin bildirim merkezine bilgi gönderildi."
        : "Ödeme onaylandı. Bildirim durumu için bildirim merkezini kontrol edin.");
    } catch (error) {
      setBankNotice(error instanceof Error ? error.message : "Havale onaylanamadı.");
    } finally {
      setBankBusy(false);
    }
  }

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
          ["Kargo yöntemi", shippingMethodTR(order.shipping_method || shipping.method)],
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
                  {item.sku ? `Ürün kodu: ${item.sku} · ` : ""}
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
          ["Yöntem", order.payment_method === "bank_transfer" ? "Havale / EFT" : "Banka / Kredi Kartı"],
          
          ["Ödeme durumu", paymentStatusTR(order.payment_status)],
          ["Kart", order.card_last4 ? `${order.card_association || "Kart"} •••• ${order.card_last4}` : "—"],
          ["Havale açıklama kodu", order.transfer_code || "—"],
        ]}
      />

      {order.payment_method === "bank_transfer" && order.status === "awaiting_bank_confirmation"
       && order.payment_status === "customer_reported_paid" ? (
        <View style={s.bankApproval}>
          <Text style={s.bankTitle}>Banka Havalesini Onayla</Text>
          <Text style={s.bankText}>
            Tutar: {money(order.total_amount)} · Açıklama: {order.transfer_code || "Kod bulunamadı"}
          </Text>
          <Text style={s.bankText}>
            Müşteri havale yaptığını bildirdi. Banka hesabına gelen hareketi kontrol edin.
          </Text>
          <TouchableOpacity onPress={() => setBankChecked(value => !value)}
            accessibilityRole="checkbox" accessibilityState={{checked:bankChecked}}>
            <Text style={s.bankText}>
              {bankChecked ? "☑" : "☐"} Banka hareketindeki tutarı ve CLK kodunu doğruladım.
            </Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={!bankChecked || bankBusy}
            onPress={() => void approveBankPayment()}
            style={[s.bankButton, (!bankChecked || bankBusy) && {opacity:0.45}]}>
            <Text style={s.bankButtonText}>
              {bankBusy ? "Onaylanıyor…" : "Ödeme Onaylandı"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {bankNotice ? <Text style={s.bankNotice}>{bankNotice}</Text> : null}

      <SectionTitle title="Kargo / Teslimat Detayları" />
      <ObjectCard value={shippingDetails} empty="Ek kargo detayı yok." />

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

function paymentStatusTR(value?: string | null) {
  const labels: Record<string,string> = {
    pending:"Ödeme bekleniyor",
    customer_reported_paid:"Müşteri havale bildirimi yaptı · banka kontrolünde",
    bank_confirmed:"Havale onaylandı",
    SUCCESS:"Ödeme alındı",
    FAILURE:"Ödeme başarısız",
  };
  return labels[String(value || "")] || "Ödeme kontrol ediliyor";
}
function shippingMethodTR(value?: string | null) {
  const labels: Record<string,string> = {
    cargo:"PTT Kargo / Kargo", freight:"Ambar / Nakliye", pickup:"Mağazadan Teslim",
  };
  return labels[String(value || "")] || "Belirtilmemiş";
}
function ObjectCard({ value, empty }: { value: Record<string, any>; empty: string }) {
  const labels: Record<string,string> = {
    carrier:"Taşıyıcı",companyName:"Ambar firması",phone:"Telefon",
    pickupTime:"Teslim alma saati",method:"Teslimat türü",
    address:"Teslimat noktası",addressLine:"Adres",
  };
  const entries = Object.entries(value || {}).filter(([key, item]) =>
    Object.prototype.hasOwnProperty.call(labels,key) &&
    item !== null && item !== undefined && item !== "" && typeof item !== "object"
  );
  if (!entries.length) return <EmptyState title="Detay yok" text={empty} />;
  return (
    <View style={s.infoCard}>
      {entries.map(([key, value], index) => (
        <View key={key} style={[s.infoRow, index === entries.length - 1 && s.noBorder]}>
          <Text style={s.infoLabel}>{labels[key]}</Text>
          <Text style={s.infoValue} numberOfLines={3}>
            {String(value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  bankApproval: {padding:16,borderRadius:16,backgroundColor:C.panel,borderWidth:1,borderColor:C.line,marginTop:12,gap:12},
  bankTitle: {color:C.text,fontSize:16,fontWeight:"700"},
  bankText: {color:C.text2,fontSize:13,lineHeight:20},
  bankButton: {backgroundColor:C.blue,borderRadius:12,paddingVertical:14,alignItems:"center"},
  bankButtonText: {color:"#FFFFFF",fontWeight:"700"},
  bankNotice: {color:C.green,fontSize:13,marginTop:10},
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
