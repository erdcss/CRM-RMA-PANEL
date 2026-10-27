import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { apiFetch } from "../lib/api";
import type { AdminOrder } from "../types";
import { C, money, shortDate, statusMeta, isApprovedBusinessOrder } from "../ui/theme";
import { Badge, EmptyState, MiniStat, PageHeader } from "./common";

export function OrdersScreen({
  onOpenOrder,
}: {
  onOpenOrder: (id: string) => void;
}) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await apiFetch<AdminOrder[]>("/api/admin/orders");
      // Only confirmed/approved orders belong on this screen. Never display
      // pending EFT, unpaid, cancelled or stock-review orders as approved.
      setOrders(Array.isArray(result) ? result.filter((item) => isApprovedBusinessOrder(item.status)) : []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Siparişler alınamadı");
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
    return orders.filter((order) => {
      if (!needle) return true;
      const billing = order.billing_details || {};
      const shipping = order.shipping_address || {};
      const haystack = [
        order.order_number,
        order.customer_email,
        billing.companyName,
        billing.recipient,
        shipping.recipient,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");
      return haystack.includes(needle);
    });
  }, [orders, query]);

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
        title="Siparişler"
        subtitle="Yalnızca onaylanan siparişler listelenir."
      />

      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Sipariş no, müşteri adı veya e-posta ara..."
            placeholderTextColor={C.muted}
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      <View style={s.stats}>
        <MiniStat icon="✓" title="Onaylanan Siparişler" value={orders.length} accent={C.green} />
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color={C.blue} size="large" style={s.loader} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Onaylanan sipariş bulunamadı" text={query.trim() ? "Aramanıza uygun onaylanan sipariş yok." : "Henüz onaylanmış bir sipariş bulunmuyor."} />
      ) : (
        <View style={s.list}>
          {filtered.map((order) => {
            const meta = statusMeta(order.status);
            const billing = order.billing_details || {};
            const shipping = order.shipping_address || {};
            const customer =
              billing.companyName ||
              billing.recipient ||
              shipping.recipient ||
              order.customer_email ||
              "Müşteri";
            const items = Array.isArray(order.items) ? order.items : [];
            const firstImage =
              typeof items[0]?.image === "string" ? items[0].image : null;

            return (
              <TouchableOpacity
                key={String(order.id)}
                style={s.card}
                activeOpacity={0.76}
                onPress={() => onOpenOrder(String(order.id))}
              >
                <View style={s.cardTop}>
                  <View style={s.cardTitleBlock}>
                    <Text style={s.orderNo}>{order.order_number || `#${order.id}`}</Text>
                    <Text style={s.orderDate}>{shortDate(order.created_at)}</Text>
                  </View>
                  <Badge label={meta.label} fg={meta.fg} bg={meta.bg} />
                </View>

                <View style={s.cardBody}>
                  <View style={s.thumbRow}>
                    {firstImage ? (
                      <Image source={{ uri: firstImage }} style={s.thumb as import("react-native").ImageStyle} resizeMode="cover" />
                    ) : (
                      <View style={s.thumbFallback}><Text style={s.thumbFallbackText}>B2B</Text></View>
                    )}
                    <View style={s.itemCount}>
                      <Text style={s.itemCountText}>+{Math.max(0, Number(order.item_count || items.length) - 1)}</Text>
                    </View>
                  </View>

                  <View style={s.customerBlock}>
                    <Text style={s.customer}>{customer}</Text>
                    <Text style={s.customerSub}>{order.customer_email || "E-posta yok"}</Text>
                  </View>

                  <View style={s.amountBlock}>
                    <Text style={s.amount}>{money(order.total_amount)}</Text>
                    <Text style={s.payment}>
                      {order.payment_method === "bank_transfer" ? "Havale / EFT" : "Kredi Kartı"}
                    </Text>
                  </View>
                  <Text style={s.chevron}>›</Text>
                </View>
              </TouchableOpacity>
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
  searchRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  searchBox: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  searchIcon: { color: C.text2, fontSize: 24, marginRight: 10 },
  searchInput: { flex: 1, color: C.text, fontSize: 14, fontWeight: "400" },
  stats: { flexDirection: "row", gap: 10, marginBottom: 18 },
  error: { color: C.red, marginBottom: 14 },
  loader: { marginTop: 30 },
  list: { gap: 10 },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    padding: 15,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardTitleBlock: { flex: 1, paddingRight: 10 },
  orderNo: { color: C.text, fontSize: 16, fontWeight: "600", letterSpacing: -0.3 },
  orderDate: { color: C.muted, fontSize: 11, marginTop: 5 },
  cardBody: { flexDirection: "row", alignItems: "center", marginTop: 16 },
  thumbRow: { flexDirection: "row", alignItems: "center" },
  thumb: { width: 54, height: 54, borderRadius: 14, backgroundColor: C.panel2 },
  thumbFallback: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: C.panel2,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbFallbackText: { color: C.text2, fontSize: 10, fontWeight: "700" },
  itemCount: {
    width: 40,
    height: 40,
    marginLeft: -8,
    borderRadius: 12,
    backgroundColor: "#1B232D",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.line,
  },
  itemCountText: { color: C.text2, fontSize: 12, fontWeight: "600" },
  customerBlock: { flex: 1, paddingHorizontal: 12 },
  customer: { color: C.text, fontSize: 14, fontWeight: "600" },
  customerSub: { color: C.muted, fontSize: 10, marginTop: 4 },
  amountBlock: { alignItems: "flex-end" },
  amount: { color: C.text, fontSize: 15, fontWeight: "600" },
  payment: { color: C.muted, fontSize: 10, marginTop: 5 },
  chevron: { color: C.text2, fontSize: 27, marginLeft: 10 },
});
