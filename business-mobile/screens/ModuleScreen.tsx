import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiFetch } from "../lib/api";
import { getAdminModule } from "../lib/admin-modules";
import { C } from "../ui/theme";
import { BackHeader, EmptyState } from "./common";

export function ModuleScreen({
  slug,
  onBack,
}: {
  slug: string;
  onBack: () => void;
}) {
  const module = useMemo(() => getAdminModule(slug), [slug]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(Boolean(module?.endpoint));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!module?.endpoint) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setError("");
    try {
      setData(await apiFetch<any>(module.endpoint));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Veri alınamadı");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [module?.endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!module) {
    return (
      <ScrollView style={s.page} contentContainerStyle={s.content}>
        <BackHeader title="Modül bulunamadı" onBack={onBack} />
      </ScrollView>
    );
  }

  const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
  const objectEntries =
    data && !Array.isArray(data) && typeof data === "object"
      ? Object.entries(data).filter(([, value]) => {
          const type = typeof value;
          return value == null || type === "string" || type === "number" || type === "boolean";
        })
      : [];

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
      <BackHeader title={module.title} subtitle={module.description} onBack={onBack} />

      {loading ? <ActivityIndicator color={C.blue} size="large" style={s.loader} /> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      {objectEntries.length > 0 ? (
        <View style={s.objectCard}>
          {objectEntries.map(([key, value], index) => (
            <View key={key} style={[s.objectRow, index === objectEntries.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={s.objectKey}>{key.replace(/_/g, " ")}</Text>
              <Text style={s.objectValue}>{compact(value)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={s.list}>
        {rows.map((item: any, index: number) => (
          <View key={String(item?.id ?? index)} style={s.card}>
            <Text style={s.title}>{itemTitle(item, index)}</Text>
            {itemSubtitle(item) ? <Text style={s.subtitle}>{compact(itemSubtitle(item))}</Text> : null}
            {item?.status !== undefined ? <Text style={s.meta}>Durum: {compact(item.status)}</Text> : null}
          </View>
        ))}
      </View>

      {!loading && module.endpoint && rows.length === 0 && objectEntries.length === 0 && !error ? (
        <EmptyState title="Kayıt bulunamadı" text="Admin web ile aynı veri kaynağı kontrol edildi." />
      ) : null}

      {!module.endpoint ? (
        <EmptyState title={module.title} text="Bu modülün mobil işlem ekranı hazırlanıyor." />
      ) : null}
    </ScrollView>
  );
}

function compact(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return Array.isArray(value) ? `${value.length} kayıt` : "Detay";
  return String(value);
}

function itemTitle(item: any, index: number) {
  return (
    item?.order_number ||
    item?.name ||
    item?.title ||
    item?.customer_name ||
    item?.company_name ||
    item?.email ||
    item?.username ||
    item?.barcode ||
    item?.code ||
    `Kayıt #${item?.id ?? index + 1}`
  );
}

function itemSubtitle(item: any) {
  return item?.customer_email || item?.brand || item?.phone || item?.city || item?.sku || item?.description || "";
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 36 },
  loader: { marginTop: 30 },
  error: { color: C.red, marginBottom: 14 },
  objectCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    overflow: "hidden",
    marginBottom: 14,
  },
  objectRow: {
    minHeight: 54,
    paddingHorizontal: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
    flexDirection: "row",
    alignItems: "center",
  },
  objectKey: { flex: 1, color: C.muted, fontSize: 11, textTransform: "capitalize" },
  objectValue: { flex: 1, color: C.text, fontSize: 12, fontWeight: "500", textAlign: "right" },
  list: { gap: 9 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    padding: 14,
  },
  title: { color: C.text, fontSize: 14, fontWeight: "600" },
  subtitle: { color: C.muted, fontSize: 11, marginTop: 5 },
  meta: { color: C.text2, fontSize: 10, marginTop: 8 },
});
