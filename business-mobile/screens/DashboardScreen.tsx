import { useCallback, useEffect, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { BusinessAuthUser } from "../lib/auth";
import { apiFetch } from "../lib/api";
import type { DashboardOverview } from "../types";
import { C, money, statusMeta, isApprovedBusinessOrder } from "../ui/theme";
import { Badge, EmptyState, SectionTitle } from "./common";
type IconName = ComponentProps<typeof Ionicons>["name"];


export function DashboardScreen({
  user,
  onOrders,
  onOpenOrder,
  onSupport,
  onProducts,
  onCustomers,
  onModule,
}: {
  user: BusinessAuthUser | null;
  onOrders: () => void;
  onOpenOrder: (id:string)=>void;
  onSupport: () => void;
  onProducts: () => void;
  onCustomers: () => void;
  onModule: (slug: string) => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const compact = windowWidth < 375;
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

  const approvedOrders = (data?.recentApprovedOrders ?? data?.recentOrders ?? [])
    .filter((order) => isApprovedBusinessOrder(order.status))
    .slice(0, 4);

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
        <View style={s.topRow}>
          <View style={s.brandBlock}>
            <Text style={[s.brand, compact && s.brandCompact]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
              Çalışkan <Text style={s.brandLight}>Business</Text>
            </Text>
            <Text style={s.welcome} numberOfLines={1}>Merhaba, {name}</Text>
          </View>
          <View style={s.userPill}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
            </View>
            {!compact && (
              <View style={s.userDetails}>
                <Text style={s.userTitle} numberOfLines={1}>Yönetici</Text>
                <Text style={s.userSub} numberOfLines={1}>Çalışkan B2B</Text>
              </View>
            )}
          </View>
        </View>
        <View style={s.heroCopy}>
          <View style={s.heroEyebrow}>
            <View style={s.heroDot} />
            <Text style={s.heroEyebrowText}>İŞLETME KONTROL PANELİ</Text>
          </View>
          <Text style={[s.heroTitle, compact && s.heroTitleCompact]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
            Yönetim merkezi
          </Text>
          <Text style={s.heroSub}>
            Sipariş, stok ve operasyonlarınız tek ekranda.
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
              icon="receipt-outline"
              title="Bugünkü Sipariş"
              value={data?.orderCount ?? 0}
              note="Canlı sipariş akışı"
              accent={C.green}
              onPress={onOrders}
            />
            <MetricCard
              icon="chatbubbles-outline"
              title="Bekleyen Destek"
              value={data?.openSupport ?? 0}
              note="Yanıt bekleyen talepler"
              accent={C.red}
              onPress={onSupport}
            />
            <MetricCard
              icon="alert-circle-outline"
              title="Düşük Stok"
              value={data?.lowStock ?? 0}
              note="Stok kontrolü gerekli"
              accent={C.orange}
              onPress={() => onModule("stok-durumu")}
            />
            <MetricCard
              icon="wallet-outline"
              title="Günlük Ciro"
              value={money(data?.todayRevenue ?? 0)}
              note="Bugünkü sipariş toplamı"
              accent={C.green}
            />
          </View>

          <View style={s.sectionWrap}><SectionTitle title="Hızlı İşlemler" /></View>
          <View style={s.quickGrid}>
            <QuickCard title="Siparişler" subtitle="Siparişleri yönet" icon="receipt-outline" onPress={onOrders} />
            <QuickCard title="Destek" subtitle="Talep ve mesajlar" icon="headset-outline" onPress={onSupport} />
            <QuickCard title="Ürünler" subtitle="Ürün ve stok" icon="cube-outline" onPress={onProducts} />
            <QuickCard title="Müşteriler" subtitle="Müşterileri yönet" icon="people-outline" onPress={onCustomers} />
          </View>

          <View style={s.sectionWrap}><SectionTitle title="Son Onaylanan Siparişler" action="Tümünü Gör" onAction={onOrders} /></View>
          <View style={s.ordersPanel}>
            {approvedOrders.length === 0 ? (
              <EmptyState title="Onaylanan sipariş yok" text="Henüz onaylanmış bir sipariş bulunmuyor." />
            ) : (
              approvedOrders.map((order) => {
                const meta = statusMeta(order.status);
                return (
                  <TouchableOpacity key={String(order.id)} style={s.orderRow} onPress={()=>onOpenOrder(String(order.id))}>
                    <View style={s.orderThumb}>
                      <Ionicons name="receipt-outline" color={C.blue} size={23} />
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
  icon: IconName;
  title: string;
  value: string | number;
  note: string;
  accent: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={s.metric} activeOpacity={onPress ? 0.75 : 1} onPress={onPress}>
      <View style={s.metricTop}>
        <View style={[s.metricIcon, { borderColor: accent + "55" }]}><Ionicons name={icon} size={23} color={accent} /></View>
        {onPress ? <Ionicons name="chevron-forward" size={17} color={C.muted} /> : null}
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
  icon: IconName;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.quick} onPress={onPress} activeOpacity={0.74}>
      <View style={s.quickIcon}><Ionicons name={icon} size={22} color="#9EC4FF" /></View>
      <Text style={s.quickTitle}>{title}</Text>
      <Text style={s.quickSub}>{subtitle}</Text>
      <Ionicons name="chevron-forward" size={17} color={C.muted} style={s.quickArrow} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  content: { paddingBottom: 118 },
  sectionWrap: { paddingHorizontal: 18 },
  hero: {
    minHeight: 212,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: C.bg2,
    borderBottomColor: C.lineSoft,
    borderBottomWidth: 1,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  heroShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(3,6,10,0.16)",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 2,
    gap: 10,
    minHeight: 50,
  },
  brandBlock: { flex: 1, minWidth: 0, paddingRight: 2, justifyContent: "center" },
  brand: { color: C.text, fontSize: 21, fontWeight: "700", letterSpacing: -0.7 },
  brandCompact: { fontSize: 19 },
  brandLight: { color: C.text2, fontWeight: "300" },
  welcome: { color: C.text2, fontSize: 12, marginTop: 5 },
  userPill: {
    flexShrink: 0,
    padding: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.lineSoft,
    backgroundColor: "rgba(10,15,21,0.88)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.white10,
    alignItems: "center",
    justifyContent: "center",
  },
  userDetails: { maxWidth: 85, paddingRight: 4 },
  avatarText: { color: C.text2, fontWeight: "600" },
  userTitle: { color: C.text, fontSize: 12, fontWeight: "600" },
  userSub: { color: C.muted, fontSize: 10, marginTop: 2 },
  heroCopy: {
    zIndex: 2,
    alignSelf: "stretch",
    paddingTop: 12,
    paddingBottom: 3,
    minWidth: 0,
  },
  heroEyebrow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  heroEyebrowText: { fontSize: 10, letterSpacing: 1.05, color: "#A4C4EE", fontWeight: "800" },
  heroTitle: {
    color: C.text,
    fontSize: 29,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -1,
    flexShrink: 1,
  },
  heroTitleCompact: { fontSize: 26, lineHeight: 32 },
  heroSub: {
    color: C.text2,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
    maxWidth: 285,
  },
  error: { color: C.red, marginHorizontal: 18, marginTop: 12 },
  grid: {
    paddingHorizontal: 18,
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metric: {
    width: "48%",
    minHeight: 146,
    padding: 14,
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
  metricTitle: { color: C.text2, fontSize: 13, marginTop: 11 },
  metricValue: { color: C.text, fontSize: 25, fontWeight: "600", marginTop: 5, letterSpacing: -0.7 },
  metricNote: { color: C.muted, fontSize: 10, marginTop: 5 },
  quickGrid: { paddingHorizontal: 18, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quick: {
    width: "47%",
    flexGrow: 1,
    minHeight: 112,
    padding: 13,
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
  quickTitle: { color: C.text, fontSize: 13, fontWeight: "600", marginTop: 12 },
  quickSub: { color: C.muted, fontSize: 9, marginTop: 4 },
  quickArrow: { position: "absolute", right: 11, top: 15 },
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
  orderMain: { flex: 1, paddingHorizontal: 12 },
  orderNo: { color: C.text, fontSize: 13, fontWeight: "600" },
  orderCustomer: { color: C.muted, fontSize: 10, marginTop: 5 },
  orderSide: { alignItems: "flex-end", gap: 5 },
  orderAmount: { color: C.text, fontSize: 12, fontWeight: "600" },
});
