import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiFetch } from "../../lib/api";
import { getAdminModule } from "../../lib/admin-modules";
import { getBusinessSession } from "../../lib/auth";

function compactValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return Array.isArray(value) ? `${value.length} kayıt` : "Detay";
  return String(value);
}

function itemTitle(item: any, index: number) {
  return item?.order_number || item?.name || item?.title || item?.customer_name || item?.company_name || item?.email || item?.username || item?.barcode || item?.code || `Kayıt #${item?.id ?? index + 1}`;
}

function itemSubtitle(item: any) {
  return item?.customer_email || item?.brand || item?.status || item?.phone || item?.city || item?.sku || item?.description || "";
}

export default function AdminModuleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const module = useMemo(() => getAdminModule(slug), [slug]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(Boolean(module?.endpoint));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getBusinessSession().then((session) => {
      if (!session) router.replace("/login");
    });
  }, [router]);

  const load = useCallback(async () => {
    if (!module?.endpoint) return;
    setError("");
    try {
      setData(await apiFetch<any>(module.endpoint));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Veri alınamadı");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [module?.endpoint]);

  useEffect(() => { void load(); }, [load]);

  const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];

  if (!module) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.center}><Text style={s.error}>Modül bulunamadı.</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>‹</Text></TouchableOpacity>
        <View style={s.headerText}>
          <Text style={s.title}>{module.title}</Text>
          <Text style={s.subtitle}>{module.description}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        {loading ? <ActivityIndicator size="large" color="#1D4ED8" style={{ marginTop: 40 }} /> : null}
        {!!error ? <View style={s.errorBox}><Text style={s.error}>{error}</Text></View> : null}

        {!loading && module.endpoint && rows.length === 0 && !error ? (
          <View style={s.empty}><Text style={s.emptyTitle}>Kayıt bulunamadı</Text><Text style={s.emptyText}>Web paneli ile aynı veri kaynağı kontrol edildi.</Text></View>
        ) : null}

        {rows.map((item: any, index: number) => (
          <View key={String(item?.id ?? index)} style={s.card}>
            <Text style={s.cardTitle}>{itemTitle(item, index)}</Text>
            {!!itemSubtitle(item) ? <Text style={s.cardSub}>{compactValue(itemSubtitle(item))}</Text> : null}
            <View style={s.meta}>
              {item?.status !== undefined ? <Text style={s.metaText}>Durum: {compactValue(item.status)}</Text> : null}
              {item?.total_amount !== undefined ? <Text style={s.metaText}>Tutar: {compactValue(item.total_amount)} ₺</Text> : null}
              {item?.stock !== undefined ? <Text style={s.metaText}>Stok: {compactValue(item.stock)}</Text> : null}
            </View>
          </View>
        ))}

        {!module.endpoint ? (
          <View style={s.info}>
            <Text style={s.infoTitle}>{module.title}</Text>
            <Text style={s.infoText}>
              Bu ekran Çalışkan Admin web panelindeki aynı modülün mobil karşılığıdır. Navigasyon yapısı hazır; modül işlemleri native mobil arayüze taşınıyor.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8F9FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#E2E5E9", backgroundColor: "#FFF" },
  back: { fontSize: 36, color: "#1D4ED8", lineHeight: 38 },
  headerText: { flex: 1 },
  title: { fontSize: 21, fontWeight: "800", color: "#18212F" },
  subtitle: { marginTop: 2, color: "#667085", fontSize: 12 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorBox: { borderRadius: 12, borderWidth: 1, borderColor: "#FDA29B", backgroundColor: "#FEF3F2", padding: 14, marginBottom: 12 },
  error: { color: "#B42318", fontWeight: "600" },
  empty: { borderRadius: 14, borderWidth: 1, borderColor: "#E2E5E9", backgroundColor: "#FFF", padding: 24, alignItems: "center" },
  emptyTitle: { fontWeight: "800", color: "#18212F" },
  emptyText: { color: "#667085", marginTop: 6, fontSize: 12, textAlign: "center" },
  card: { borderRadius: 14, borderWidth: 1, borderColor: "#E2E5E9", backgroundColor: "#FFF", padding: 14, marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: "#18212F" },
  cardSub: { marginTop: 5, color: "#667085", fontSize: 13 },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  metaText: { fontSize: 12, color: "#344054", fontWeight: "600" },
  info: { borderRadius: 16, borderWidth: 1, borderColor: "#D0D5DD", backgroundColor: "#FFF", padding: 18 },
  infoTitle: { fontSize: 18, fontWeight: "800", color: "#18212F" },
  infoText: { marginTop: 8, fontSize: 14, lineHeight: 21, color: "#667085" },
});
