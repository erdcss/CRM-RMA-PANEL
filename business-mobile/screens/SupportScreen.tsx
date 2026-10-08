import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiFetch } from "../lib/api";
import type { SupportItem } from "../types";
import { C, shortDate } from "../ui/theme";
import { EmptyState, MiniStat, PageHeader } from "./common";

export function SupportScreen() {
  const [items, setItems] = useState<SupportItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await apiFetch<SupportItem[]>("/api/admin/b2b-support");
      setItems(Array.isArray(result) ? result : []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Destek kayıtları alınamadı");
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
    if (!needle) return items;
    return items.filter((item) =>
      [item.subject, item.message, item.customer_name, item.customer_email, item.code]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(needle),
    );
  }, [items, query]);

  const openCount = items.filter((item) =>
    !["closed", "resolved", "done"].includes(String(item.status || "open").toLowerCase()),
  ).length;

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
      <PageHeader title="Destek" subtitle="Müşteri taleplerini ve destek mesajlarını takip edin." />

      <View style={s.searchBox}>
        <Text style={s.searchIcon}>⌕</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Talep, müşteri veya konu ara..."
          placeholderTextColor={C.muted}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <View style={s.stats}>
        <MiniStat icon="◌" title="Toplam Talep" value={items.length} />
        <MiniStat icon="!" title="Açık Talep" value={openCount} accent={C.orange} />
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color={C.blue} size="large" style={s.loader} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Destek kaydı yok" text="Görüntülenecek destek talebi bulunmuyor." />
      ) : (
        <View style={s.list}>
          {filtered.map((item) => (
            <View key={String(item.id)} style={s.card}>
              <View style={s.dot} />
              <View style={s.main}>
                <Text style={s.subject}>{item.subject || item.title || item.code || `Talep #${item.id}`}</Text>
                <Text style={s.customer}>{item.customer_name || item.customer_email || "Müşteri"}</Text>
                {item.message ? <Text style={s.message} numberOfLines={2}>{item.message}</Text> : null}
                <Text style={s.date}>{shortDate(item.created_at)}</Text>
              </View>
              <Text style={s.status}>{item.status || "open"}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 118 },
  searchBox: {
    minHeight: 56,
    marginBottom: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  searchIcon: { color: C.text2, fontSize: 24, marginRight: 10 },
  searchInput: { flex: 1, color: C.text, fontSize: 14 },
  stats: { flexDirection: "row", gap: 10, marginBottom: 18 },
  error: { color: C.red, marginBottom: 14 },
  loader: { marginTop: 30 },
  list: { gap: 10 },
  card: {
    minHeight: 100,
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  dot: { width: 9, height: 9, borderRadius: 99, backgroundColor: C.blue, marginTop: 7, marginRight: 11 },
  main: { flex: 1 },
  subject: { color: C.text, fontSize: 14, fontWeight: "600" },
  customer: { color: C.text2, fontSize: 11, marginTop: 4 },
  message: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 7 },
  date: { color: C.muted, fontSize: 9, marginTop: 8 },
  status: { color: C.orange, fontSize: 10, fontWeight: "600", marginLeft: 8 },
});
