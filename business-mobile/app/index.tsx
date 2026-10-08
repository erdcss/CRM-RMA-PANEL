import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiFetch } from "../lib/api";
import { getBusinessSession } from "../lib/auth";

type DashboardOverview = {
  sessionUsers: number;
  liveUsers: number;
  conversionRate: number;
  orderCount: number;
  activeReturns: number;
  recentOrders: Array<{
    id: string | number;
    order_number?: string | null;
    customer_email?: string | null;
    status: string;
    item_count: number;
    total_amount: string | number;
    created_at: string;
  }>;
  recentReturns: Array<{
    id: number;
    name?: string | null;
    brand?: string | null;
    status: string;
    created_at: string;
    customer_name?: string | null;
  }>;
};

export default function BusinessHome() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const overview = await apiFetch<DashboardOverview>("/api/admin/dashboard-overview");
      setData(overview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dashboard verileri alınamadı");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    getBusinessSession().then((session) => {
      if (!active) return;
      if (!session) {
        router.replace("/login");
        return;
      }
      setUsername(session.user.email || session.user.username || "Yönetici");
      setReady(true);
      void load();
    });

    const timer = setInterval(() => {
      void load();
    }, 15000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [load, router]);

  if (!ready) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color="#1D4ED8" />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.topbar}>
        <View style={s.topbarText}>
          <Text style={s.brand}>Çalışkan Business</Text>
          <Text style={s.user} numberOfLines={1}>{username}</Text>
        </View>
        <TouchableOpacity style={s.menuButton} onPress={() => router.push("/menu")}>
          <Text style={s.menuButtonText}>Menü</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
      >
        <View style={s.sectionHead}>
          <View>
            <Text style={s.kicker}>CANLI OPERASYON</Text>
            <Text style={s.title}>Yönetim Dashboard</Text>
            <Text style={s.subtitle}>Çalışkan Admin ile aynı veri kaynağı, mobil yönetim görünümü.</Text>
          </View>
        </View>

        {!!error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        <View style={s.metrics}>
          <Metric title="Oturum Kullanıcısı" value={data?.sessionUsers ?? 0} />
          <Metric title="Canlı Kullanıcı" value={data?.liveUsers ?? 0} />
          <Metric title="Dönüşüm Oranı" value={`%${Number(data?.conversionRate ?? 0).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`} />
          <Metric title="Bugünkü Sipariş" value={data?.orderCount ?? 0} />
          <Metric title="Aktif İade" value={data?.activeReturns ?? 0} />
        </View>

        <SectionTitle title="Hızlı İşlemler" />
        <View style={s.quickGrid}>
          {[
            ["Siparişler", "siparisler"],
            ["Ürünler", "urunler"],
            ["Stok Durumu", "stok-durumu"],
            ["İade İşlemleri", "iade-islemleri"],
            ["Başvurular", "basvurular"],
            ["RMA Kayıtları", "kayitlar"],
          ].map(([title, slug]) => (
            <TouchableOpacity
              key={slug}
              style={s.quickCard}
              onPress={() => router.push({ pathname: "/module/[slug]", params: { slug } } as any)}
            >
              <Text style={s.quickTitle}>{title}</Text>
              <Text style={s.quickArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <SectionTitle title="Son Siparişler" action="Tümü" onAction={() => router.push({ pathname: "/module/[slug]", params: { slug: "siparisler" } } as any)} />
        <View style={s.panel}>
          {(data?.recentOrders || []).length === 0 ? (
            <Text style={s.empty}>Henüz sipariş kaydı yok.</Text>
          ) : (
            data?.recentOrders.slice(0, 6).map((order) => (
              <View key={String(order.id)} style={s.listRow}>
                <View style={s.listMain}>
                  <Text style={s.listTitle}>{order.order_number || `#${order.id}`}</Text>
                  <Text style={s.listSub}>{order.customer_email || "—"}</Text>
                </View>
                <View style={s.listSide}>
                  <Text style={s.amount}>{Number(order.total_amount || 0).toLocaleString("tr-TR")} ₺</Text>
                  <Text style={s.status}>{order.status || "Bekliyor"}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <SectionTitle title="Son İadeler" action="Tümü" onAction={() => router.push({ pathname: "/module/[slug]", params: { slug: "iade-islemleri" } } as any)} />
        <View style={s.panel}>
          {(data?.recentReturns || []).length === 0 ? (
            <Text style={s.empty}>Henüz iade kaydı yok.</Text>
          ) : (
            data?.recentReturns.slice(0, 5).map((item) => (
              <View key={String(item.id)} style={s.listRow}>
                <View style={s.listMain}>
                  <Text style={s.listTitle}>{item.name || item.brand || `İade #${item.id}`}</Text>
                  <Text style={s.listSub}>{item.customer_name || "—"}</Text>
                </View>
                <Text style={s.status}>{item.status || "Bekliyor"}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return (
    <View style={s.metric}>
      <Text style={s.metricTitle}>{title}</Text>
      <Text style={s.metricValue}>{value}</Text>
    </View>
  );
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.sectionTitleRow}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action ? <TouchableOpacity onPress={onAction}><Text style={s.sectionAction}>{action}</Text></TouchableOpacity> : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8F9FA" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F8F9FA" },
  topbar: { minHeight: 64, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#E2E5E9", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topbarText: { flex: 1, paddingRight: 12 },
  brand: { fontSize: 18, fontWeight: "900", color: "#18212F" },
  user: { marginTop: 2, color: "#667085", fontSize: 11 },
  menuButton: { backgroundColor: "#1D4ED8", minHeight: 38, paddingHorizontal: 15, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuButtonText: { color: "#FFF", fontWeight: "800", fontSize: 13 },
  content: { padding: 16, paddingBottom: 40 },
  sectionHead: { marginBottom: 18 },
  kicker: { fontSize: 11, fontWeight: "800", color: "#1D4ED8", letterSpacing: 1.2 },
  title: { marginTop: 5, fontSize: 28, fontWeight: "900", color: "#18212F", letterSpacing: -0.5 },
  subtitle: { marginTop: 7, color: "#667085", fontSize: 13, lineHeight: 19 },
  errorBox: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#FDA29B", backgroundColor: "#FEF3F2", marginBottom: 14 },
  errorText: { color: "#B42318", fontWeight: "600", fontSize: 13 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { width: "48%", minHeight: 96, padding: 14, borderRadius: 14, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E2E5E9" },
  metricTitle: { color: "#667085", fontSize: 12, fontWeight: "600" },
  metricValue: { marginTop: 11, color: "#18212F", fontSize: 25, fontWeight: "900" },
  sectionTitleRow: { marginTop: 24, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 18, color: "#18212F", fontWeight: "900" },
  sectionAction: { color: "#1D4ED8", fontSize: 13, fontWeight: "800" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickCard: { width: "48%", minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, borderRadius: 13, borderWidth: 1, borderColor: "#E2E5E9", backgroundColor: "#FFF" },
  quickTitle: { color: "#18212F", fontWeight: "800", fontSize: 13 },
  quickArrow: { color: "#1D4ED8", fontSize: 24 },
  panel: { overflow: "hidden", borderRadius: 14, borderWidth: 1, borderColor: "#E2E5E9", backgroundColor: "#FFF" },
  listRow: { minHeight: 70, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E2E5E9", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  listMain: { flex: 1, paddingRight: 12 },
  listSide: { alignItems: "flex-end" },
  listTitle: { color: "#18212F", fontWeight: "800", fontSize: 14 },
  listSub: { color: "#667085", fontSize: 11, marginTop: 4 },
  amount: { color: "#18212F", fontWeight: "800", fontSize: 13 },
  status: { color: "#667085", fontSize: 11, marginTop: 4, fontWeight: "600" },
  empty: { padding: 20, color: "#667085", textAlign: "center", fontSize: 13 },
});
