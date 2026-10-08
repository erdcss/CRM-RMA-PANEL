import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { BusinessAuthUser } from "../lib/auth";
import { apiFetch } from "../lib/api";
import type { DashboardOverview } from "../types";
import { C, money, statusMeta } from "../ui/theme";
import { Badge, EmptyState, SectionTitle } from "./common";
import { WarehouseBackdrop } from "../components/WarehouseBackdrop";

export function DashboardScreen({
  user,
  onOrders,
  onSupport,
  onModule,
}: {
  user: BusinessAuthUser | null;
  onOrders: () => void;
  onSupport: () => void;
  onModule: (slug: string) => void;
}) {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await apiFetch<DashboardOverview>("/api/admin/dashboard-overview"));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Dashboard verileri alınamadı");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  const name =
    user?.username && user.username !== "admin"
      ? user.username
      : user?.email?.split("@")[0] || "Yönetici";

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
      <View style={s.hero}>
        <WarehouseBackdrop />
        <View style={s.heroShade} />
        <View style={s.topRow}>
          <View>
            <Text style={s.brand}>
              Çalışkan <Text style={s.brandLight}>Business</Text>
            </Text>
            <Text style={s.welcome}>Merhaba, {name}</Text>
          </View>
          <View style={s.userPill}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={s.userTitle}>Yönetici</Text>
              <Text style={s.userSub}>Çalışkan B2B</Text>
            </View>
          </View>
        </View>

        <View style={s.heroCopy}>
          <Text style={s.heroTitle}>Yönetim{"
"}Dashboard</Text>
          <Text style={s.heroSub}>
            İşletmenizi tek ekrandan yönetin, her zaman bir adım önde olun.
          </Text>
        </View>
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color={C.blue} size="large" style={{ marginTop: 28 }} />
      ) : (
        <>
          <View style={s.grid}>
            <MetricCard
              icon="▱"
              title="Bugünkü Sipariş"
              value={data?.orderCount ?? 0}
              note="Canlı sipariş akışı"
              accent={C.green}
              onPress={onOrders}
            />
            <MetricCard
              icon="◌"
              title="Bekleyen Destek"
              value={data?.openSupport ?? 0}
              note="Yanıt bekleyen talepler"
              accent={C.red}
              onPress={onSupport}
            />
            <MetricCard
              icon="□"
              title="Düşük Stok"
              value={data?.lowStock ?? 0}
              note="Stok kontrolü gerekli"
              accent={C.orange}
              onPress={() => onModule("stok-durumu")}
            />
            <MetricCard
              icon="▥"
              title="Günlük Ciro"
              value={money(data?.todayRevenue ?? 0)}
              note="Bugünkü onaylı siparişler"
              accent={C.green}
            />
          </View>

          <SectionTitle title="Hızlı İşlemler" />
          <View style={s.quickGrid}>
            <QuickCard title="Siparişler" subtitle="Siparişleri yönet" icon="▱" onPress={onOrders} />
            <QuickCard title="Destek" subtitle="Talep ve mesajlar" icon="◌" onPress={onSupport} />
            <QuickCard title="Ürünler" subtitle="Ürünleri düzenle" icon="□" onPress={() => onModule("urunler")} />
            <QuickCard title="Müşteriler" subtitle="Müşteri yönetimi" icon="◎" onPress={() => onModule("musteriler")} />
          </View>

          <SectionTitle title="Son Siparişler" action="Tümünü Gör" onAction={onOrders} />
          <View style={s.ordersPanel}>
            {(data?.recentOrders || []).length === 0 ? (
              <EmptyState title="Sipariş yok" text="Henüz görüntülenecek sipariş bulunmuyor." />
            ) : (
              data?.recentOrders?.slice(0, 4).map((order) => {
                const meta = statusMeta(order.status);
                return (
                  <TouchableOpacity key={String(order.id)} style={s.orderRow} onPress={onOrders}>
                    <View style={s.orderThumb}>
                      <Text style={s.orderThumbText}>B2B</Text>
                    </View>
                    <View style={s.orderMain}>
                      <Text style={s.orderNo}>{order.order_number || `#${order.id}`}</Text>
                      <Text style={s.orderCustomer}>{order.customer_email || "Müşteri"}</Text>
                    </View>
                    <View style={s.orderSide}>
                      <Badge label={meta.label} fg={meta.fg} bg={meta.bg} />
                      <Text style={s.orderAmount}>{money(order.total_amount)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function MetricCard({
  icon,
  title,
  value,
  note,
  accent,
  onPress,
}: {
  icon: string;
  title: string;
  value: string | number;
  note: string;
  accent: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={s.metric} activeOpacity={onPress ? 0.75 : 1} onPress={onPress}>
      <View style={s.metricTop}>
        <View style={s.metricIcon}><Text style={s.metricIconText}>{icon}</Text></View>
        <Text style={[s.metricTrend, { color: accent }]}>↑</Text>
      </View>
      <Text style={s.metricTitle}>{title}</Text>
      <Text style={s.metricValue} numberOfLines={1}>{value}</Text>
      <Text style={s.metricNote}>{note}</Text>
    </TouchableOpacity>
  );
}

function QuickCard({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.quick} onPress={onPress} activeOpacity={0.74}>
      <View style={s.quickIcon}><Text style={s.quickIconText}>{icon}</Text></View>
      <Text style={s.quickTitle}>{title}</Text>
      <Text style={s.quickSub}>{subtitle}</Text>
      <Text style={s.quickArrow}>›</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  content: { paddingBottom: 118 },
  hero: {
    minHeight: 410,
    paddingHorizontal: 18,
    paddingTop: 10,
    overflow: "hidden",
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3,6,10,0.30)",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 2,
  },
  brand: { color: C.text, fontSize: 22, fontWeight: "650", letterSpacing: -0.7 },
  brandLight: { color: C.text2, fontWeight: "300" },
  welcome: { color: C.text2, fontSize: 13, marginTop: 5 },
  userPill: {
    minWidth: 138,
    padding: 8,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: C.lineSoft,
    backgroundColor: "rgba(10,15,21,0.78)",
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 38,
    height: 38,
    marginRight: 9,
    borderRadius: 14,
    backgroundColor: C.white10,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: C.text2, fontWeight: "600" },
  userTitle: { color: C.text, fontSize: 12, fontWeight: "600" },
  userSub: { color: C.muted, fontSize: 10, marginTop: 2 },
  heroCopy: { zIndex: 2, marginTop: 54, width: "64%" },
  heroTitle: {
    color: C.text,
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "700",
    letterSpacing: -1.7,
  },
  heroSub: {
    color: C.text2,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 14,
    fontWeight: "400",
  },
  error: { color: C.red, marginHorizontal: 18, marginTop: 12 },
  grid: {
    paddingHorizontal: 18,
    marginTop: -24,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metric: {
    width: "48%",
    minHeight: 154,
    padding: 15,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "rgba(14,21,29,0.96)",
  },
  metricTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metricIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: C.white06,
    borderWidth: 1,
    borderColor: C.lineSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  metricIconText: { color: C.text2, fontSize: 20 },
  metricTrend: { fontSize: 17, fontWeight: "600" },
  metricTitle: { color: C.text2, fontSize: 13, marginTop: 11 },
  metricValue: { color: C.text, fontSize: 25, fontWeight: "650", marginTop: 5, letterSpacing: -0.7 },
  metricNote: { color: C.muted, fontSize: 10, marginTop: 5 },
  quickGrid: { paddingHorizontal: 18, flexDirection: "row", gap: 9 },
  quick: {
    flex: 1,
    minHeight: 142,
    padding: 12,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.lineSoft,
    backgroundColor: C.white06,
    alignItems: "center",
    justifyContent: "center",
  },
  quickIconText: { color: C.text2, fontSize: 19 },
  quickTitle: { color: C.text, fontSize: 13, fontWeight: "600", marginTop: 12 },
  quickSub: { color: C.muted, fontSize: 9, marginTop: 4 },
  quickArrow: { color: C.text2, fontSize: 22, position: "absolute", right: 10, bottom: 9 },
  ordersPanel: {
    marginHorizontal: 18,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: C.panel,
  },
  orderRow: {
    minHeight: 82,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
    flexDirection: "row",
    alignItems: "center",
  },
  orderThumb: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: "#171F28",
    alignItems: "center",
    justifyContent: "center",
  },
  orderThumbText: { color: C.text2, fontSize: 11, fontWeight: "700" },
  orderMain: { flex: 1, paddingHorizontal: 12 },
  orderNo: { color: C.text, fontSize: 13, fontWeight: "600" },
  orderCustomer: { color: C.muted, fontSize: 10, marginTop: 5 },
  orderSide: { alignItems: "flex-end", gap: 5 },
  orderAmount: { color: C.text, fontSize: 12, fontWeight: "600" },
});
