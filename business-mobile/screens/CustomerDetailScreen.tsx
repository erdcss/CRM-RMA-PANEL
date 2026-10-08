import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiFetch } from "../lib/api";
import type { B2BCustomer } from "../types";
import { C, money, segmentMeta, shortDate } from "../ui/theme";
import { BackHeader, Badge, EmptyState, SectionTitle } from "./common";

export function CustomerDetailScreen({
  id,
  onBack,
}: {
  id: string;
  onBack: () => void;
}) {
  const [customer, setCustomer] = useState<B2BCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setCustomer(await apiFetch<B2BCustomer>(`/api/admin/b2b-customers/${encodeURIComponent(id)}`));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Müşteri detayı alınamadı");
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

  if (!customer || error) {
    return (
      <ScrollView style={s.page} contentContainerStyle={s.content}>
        <BackHeader title="Müşteri Detayı" onBack={onBack} />
        <EmptyState title="Müşteri açılamadı" text={error || "Müşteri bulunamadı."} />
      </ScrollView>
    );
  }

  const meta = segmentMeta(customer.segment);
  const addresses = Array.isArray(customer.addresses) ? customer.addresses : [];
  const orders = Array.isArray(customer.orders) ? customer.orders : [];

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <BackHeader
        title={customer.company_name || "Müşteri Detayı"}
        subtitle={customer.contact_name || customer.email || ""}
        onBack={onBack}
      />

      <View style={s.profileCard}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>
            {(customer.company_name || customer.contact_name || "M").slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={s.profileMain}>
          <Text style={s.company}>{customer.company_name || "Firma adı yok"}</Text>
          <Text style={s.contact}>{customer.contact_name || customer.email || "Yetkili yok"}</Text>
        </View>
        <Badge label={meta.label} fg={meta.fg} bg={meta.bg} />
      </View>

      <View style={s.stats}>
        <Stat label="Toplam Sipariş" value={String(customer.total_orders || 0)} />
        <Stat label="Toplam Ciro" value={money(customer.total_revenue)} />
        <Stat label="Güncel Bakiye" value={money(customer.current_balance)} />
      </View>

      <SectionTitle title="İletişim ve Firma" />
      <InfoCard
        rows={[
          ["Yetkili", customer.contact_name || "—"],
          ["E-posta", customer.email || "—"],
          ["Telefon", customer.phone || addresses[0]?.phone || "—"],
          ["Vergi no", customer.tax_number || "—"],
          ["Vergi dairesi", customer.tax_office || "—"],
          ["Kayıt tarihi", shortDate(customer.created_at)],
        ]}
      />

      <SectionTitle title="Adresler" />
      {addresses.length === 0 ? (
        <EmptyState title="Adres yok" text="Bu müşteri için kayıtlı adres bulunmuyor." />
      ) : (
        <View style={s.stack}>
          {addresses.map((address, index) => (
            <View key={String(address.id || index)} style={s.addressCard}>
              <View style={s.addressTop}>
                <Text style={s.addressTitle}>{address.title || (address.is_default ? "Varsayılan Adres" : `Adres ${index + 1}`)}</Text>
                {address.is_default ? <Text style={s.defaultText}>Varsayılan</Text> : null}
              </View>
              <Text style={s.addressText}>
                {[address.address_line, address.district, address.city, address.postal_code]
                  .filter(Boolean)
                  .join(" / ")}
              </Text>
              <Text style={s.addressMeta}>
                {[address.recipient, address.phone].filter(Boolean).join(" · ")}
              </Text>
            </View>
          ))}
        </View>
      )}

      <SectionTitle title="Sipariş Geçmişi" />
      {orders.length === 0 ? (
        <EmptyState title="Sipariş yok" text="Bu müşterinin henüz siparişi bulunmuyor." />
      ) : (
        <View style={s.ordersPanel}>
          {orders.map((order, index) => (
            <View key={String(order.id || index)} style={s.orderRow}>
              <View style={s.orderMain}>
                <Text style={s.orderNo}>{order.order_number || `#${order.id}`}</Text>
                <Text style={s.orderMeta}>{shortDate(order.created_at)} · {order.status || "Bekliyor"}</Text>
              </View>
              <Text style={s.orderAmount}>{money(order.total_amount)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function InfoCard({ rows }: { rows: Array<[string, string]> }) {
  return (
    <View style={s.infoCard}>
      {rows.map(([label, value], index) => (
        <View key={label} style={[s.infoRow, index === rows.length - 1 && { borderBottomWidth: 0 }]}>
          <Text style={s.infoLabel}>{label}</Text>
          <Text style={s.infoValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 36 },
  center: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  profileCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: "#1E2834",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: C.text2, fontSize: 27, fontWeight: "600" },
  profileMain: { flex: 1, paddingHorizontal: 13 },
  company: { color: C.text, fontSize: 17, fontWeight: "650" },
  contact: { color: C.muted, fontSize: 11, marginTop: 5 },
  stats: { flexDirection: "row", gap: 8, marginTop: 12 },
  stat: {
    flex: 1,
    minHeight: 90,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel2,
    padding: 12,
  },
  statLabel: { color: C.muted, fontSize: 9 },
  statValue: { color: C.text, fontSize: 14, fontWeight: "600", marginTop: 8 },
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
  infoLabel: { width: "36%", color: C.muted, fontSize: 11 },
  infoValue: { flex: 1, color: C.text, fontSize: 12, fontWeight: "500", textAlign: "right" },
  stack: { gap: 9 },
  addressCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    padding: 14,
  },
  addressTop: { flexDirection: "row", justifyContent: "space-between" },
  addressTitle: { color: C.text, fontSize: 13, fontWeight: "600" },
  defaultText: { color: C.blue, fontSize: 10, fontWeight: "600" },
  addressText: { color: C.text2, fontSize: 11, lineHeight: 17, marginTop: 8 },
  addressMeta: { color: C.muted, fontSize: 10, marginTop: 7 },
  ordersPanel: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    overflow: "hidden",
  },
  orderRow: {
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
    flexDirection: "row",
    alignItems: "center",
  },
  orderMain: { flex: 1 },
  orderNo: { color: C.text, fontSize: 13, fontWeight: "600" },
  orderMeta: { color: C.muted, fontSize: 10, marginTop: 5 },
  orderAmount: { color: C.text, fontSize: 13, fontWeight: "650" },
});
