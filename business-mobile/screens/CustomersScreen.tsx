import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { apiFetch } from "../lib/api";
import type { B2BCustomer } from "../types";
import { C, money, segmentMeta, shortDate } from "../ui/theme";
import { Badge, EmptyState, MiniStat, PageHeader } from "./common";

const filters = ["Tümü", "Aktif", "Riskli", "Yeni", "VIP"];

export function CustomersScreen({
  onOpenCustomer,
}: {
  onOpenCustomer: (id: string) => void;
}) {
  const [customers, setCustomers] = useState<B2BCustomer[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Tümü");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await apiFetch<B2BCustomer[]>("/api/admin/b2b-customers");
      const rows = Array.isArray(result) ? result : [];
      setCustomers(rows);
      if (!expanded && rows[0]?.id !== undefined) setExpanded(String(rows[0].id));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Müşteriler alınamadı");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [expanded]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    return customers.filter((customer) => {
      const segment = segmentMeta(customer.segment).label;
      if (filter !== "Tümü" && segment !== filter) return false;
      if (!needle) return true;
      const haystack = [
        customer.company_name,
        customer.contact_name,
        customer.email,
        customer.phone,
        customer.city,
        customer.tax_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");
      return haystack.includes(needle);
    });
  }, [customers, query, filter]);

  const summary = useMemo(() => ({
    active: customers.filter((c) => segmentMeta(c.segment).label === "Aktif").length,
    risky: customers.filter((c) => segmentMeta(c.segment).label === "Riskli").length,
    vip: customers.filter((c) => segmentMeta(c.segment).label === "VIP").length,
  }), [customers]);

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
        title="Müşteriler"
        subtitle="Müşteri hesaplarını ve sipariş geçmişlerini yönetin."
      />

      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Müşteri adı, firma, telefon veya e-posta ara..."
            placeholderTextColor={C.muted}
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <TouchableOpacity style={s.filterButton}>
          <Text style={s.filterIcon}>≡</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRail}>
        {filters.map((item) => (
          <TouchableOpacity
            key={item}
            style={[s.filterChip, filter === item && s.filterChipActive]}
            onPress={() => setFilter(item)}
          >
            <Text style={[s.filterText, filter === item && s.filterTextActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={s.stats}>
        <MiniStat icon="◎" title="Toplam Müşteri" value={customers.length} />
        <MiniStat icon="✓" title="Aktif" value={summary.active} accent={C.green} />
        <MiniStat icon="!" title="Borç Riski" value={summary.risky} accent={C.orange} />
        <MiniStat icon="♢" title="VIP" value={summary.vip} accent={C.blue} />
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color={C.blue} size="large" style={s.loader} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Müşteri bulunamadı" text="Arama veya filtreye uygun müşteri yok." />
      ) : (
        <View style={s.list}>
          {filtered.map((customer) => {
            const id = String(customer.id);
            const isOpen = expanded === id;
            const meta = segmentMeta(customer.segment);
            const initial = (customer.company_name || customer.contact_name || customer.email || "M")
              .slice(0, 1)
              .toUpperCase();

            return (
              <View key={id} style={[s.card, isOpen && s.cardOpen]}>
                <TouchableOpacity
                  activeOpacity={0.78}
                  style={s.cardTop}
                  onPress={() => setExpanded(isOpen ? null : id)}
                >
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>{initial}</Text>
                  </View>
                  <View style={s.main}>
                    <Text style={s.company}>{customer.company_name || "Firma adı yok"}</Text>
                    <Text style={s.companySub}>{customer.contact_name || customer.email || "Yetkili yok"}</Text>
                    <View style={s.metaRow}>
                      <Text style={s.metaText}>{customer.city || "Şehir yok"}</Text>
                      <Text style={s.metaText}>#{String(customer.id).padStart(4, "0")}</Text>
                    </View>
                  </View>
                  <View style={s.side}>
                    <Badge label={meta.label} fg={meta.fg} bg={meta.bg} />
                    <Text style={s.chevron}>{isOpen ? "⌃" : "›"}</Text>
                  </View>
                </TouchableOpacity>

                {isOpen ? (
                  <View style={s.expanded}>
                    <View style={s.contactGrid}>
                      <ContactBox label="Telefon" value={customer.phone || "—"} />
                      <ContactBox label="E-posta" value={customer.email || "—"} />
                    </View>

                    <View style={s.addressBox}>
                      <Text style={s.addressLabel}>Adres</Text>
                      <Text style={s.addressText}>
                        {[customer.address_line, customer.district, customer.city]
                          .filter(Boolean)
                          .join(" / ") || "Adres bilgisi yok"}
                      </Text>
                    </View>

                    <View style={s.financialGrid}>
                      <DataBox label="Toplam Sipariş" value={String(customer.total_orders || 0)} note={customer.last_order_at ? `Son: ${shortDate(customer.last_order_at)}` : "Sipariş yok"} />
                      <DataBox label="Toplam Ciro" value={money(customer.total_revenue)} note="Tüm zamanlar" />
                      <DataBox label="Güncel Bakiye" value={money(customer.current_balance)} note={`Limit: ${money(customer.credit_limit)}`} />
                    </View>

                    <TouchableOpacity style={s.detailButton} onPress={() => onOpenCustomer(id)}>
                      <Text style={s.detailButtonText}>Müşteri detayını aç</Text>
                      <Text style={s.detailButtonArrow}>›</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={s.compactFooter} onPress={() => onOpenCustomer(id)}>
                    <Text style={s.compactText}>{customer.total_orders || 0} sipariş</Text>
                    <Text style={s.compactText}>{money(customer.total_revenue)}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function ContactBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.contactBox}>
      <Text style={s.contactValue} numberOfLines={1}>{value}</Text>
      <Text style={s.contactLabel}>{label}</Text>
    </View>
  );
}

function DataBox({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <View style={s.dataBox}>
      <Text style={s.dataLabel}>{label}</Text>
      <Text style={s.dataValue} numberOfLines={1}>{value}</Text>
      <Text style={s.dataNote} numberOfLines={1}>{note}</Text>
    </View>
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
  searchInput: { flex: 1, color: C.text, fontSize: 14 },
  filterButton: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  filterIcon: { color: C.text2, fontSize: 22 },
  filterRail: { gap: 8, paddingBottom: 18 },
  filterChip: {
    minHeight: 42,
    paddingHorizontal: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipActive: { borderColor: "#8FB7FF", backgroundColor: C.blueSoft },
  filterText: { color: C.text2, fontSize: 12 },
  filterTextActive: { color: C.text, fontWeight: "600" },
  stats: { flexDirection: "row", gap: 10, marginBottom: 18 },
  error: { color: C.red, marginBottom: 14 },
  loader: { marginTop: 30 },
  list: { gap: 10 },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    overflow: "hidden",
  },
  cardOpen: { borderColor: C.blue },
  cardTop: { flexDirection: "row", alignItems: "center", padding: 14 },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 17,
    backgroundColor: "#1E2834",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: C.text2, fontSize: 25, fontWeight: "600" },
  main: { flex: 1, paddingHorizontal: 12 },
  company: { color: C.text, fontSize: 15, fontWeight: "650" },
  companySub: { color: C.muted, fontSize: 11, marginTop: 4 },
  metaRow: { flexDirection: "row", gap: 10, marginTop: 7 },
  metaText: { color: C.text2, fontSize: 10 },
  side: { alignItems: "flex-end", gap: 7 },
  chevron: { color: C.text2, fontSize: 23 },
  expanded: {
    padding: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
  },
  contactGrid: { flexDirection: "row", gap: 10 },
  contactBox: {
    flex: 1,
    minHeight: 62,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel2,
    padding: 12,
  },
  contactValue: { color: C.text, fontSize: 12, fontWeight: "500" },
  contactLabel: { color: C.muted, fontSize: 9, marginTop: 5 },
  addressBox: {
    marginTop: 10,
    minHeight: 72,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel2,
    padding: 12,
  },
  addressLabel: { color: C.muted, fontSize: 9 },
  addressText: { color: C.text2, fontSize: 11, lineHeight: 17, marginTop: 5 },
  financialGrid: { flexDirection: "row", gap: 8, marginTop: 10 },
  dataBox: {
    flex: 1,
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel2,
    padding: 11,
  },
  dataLabel: { color: C.muted, fontSize: 9 },
  dataValue: { color: C.text, fontSize: 14, fontWeight: "600", marginTop: 7 },
  dataNote: { color: C.muted, fontSize: 8, marginTop: 6 },
  detailButton: {
    minHeight: 48,
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: C.blueSoft,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.35)",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailButtonText: { color: "#9FC0FF", fontSize: 12, fontWeight: "600" },
  detailButtonArrow: { color: "#9FC0FF", fontSize: 22 },
  compactFooter: {
    minHeight: 42,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    paddingHorizontal: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  compactText: { color: C.text2, fontSize: 10 },
});
