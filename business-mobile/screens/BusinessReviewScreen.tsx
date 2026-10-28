import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../ui/theme";

type ReviewSection = "dashboard" | "orders" | "products" | "customers" | "more";
const sections: Array<{ key: ReviewSection; label: string }> = [
  { key: "dashboard", label: "Panel" },
  { key: "orders", label: "Siparişler" },
  { key: "products", label: "Ürünler" },
  { key: "customers", label: "Müşteriler" },
  { key: "more", label: "Diğer" },
];

const sampleOrders = [
  { id: "DEMO-001", customer: "Örnek Bayi A", status: "Hazırlanıyor", total: "₺2.450" },
  { id: "DEMO-002", customer: "Örnek Bayi B", status: "Onaylandı", total: "₺1.180" },
];
const sampleProducts = [
  { name: "Örnek Elektrikli Ev Aleti", sku: "DEMO-101", stock: "24" },
  { name: "Örnek Mutfak Ürünü", sku: "DEMO-102", stock: "6" },
];
const sampleCustomers = [
  { name: "Örnek Bayi A", status: "Aktif", city: "İstanbul" },
  { name: "Örnek Bayi B", status: "İncelemede", city: "Ankara" },
];

/**
 * An isolated, read-only demonstration area for App Store review.
 * No privileged API calls, real company data or mutating actions.
 */
export function BusinessReviewScreen({ onLogout }: { onLogout: () => void }) {
  const [section, setSection] = useState<ReviewSection>("dashboard");
  const [selected, setSelected] = useState<string | null>(null);

  const changeSection = (next: ReviewSection) => {
    setSection(next);
    setSelected(null);
  };

  return (
    <SafeAreaView style={s.root} edges={["top", "left", "right", "bottom"]}>
      <View style={s.header}>
        <View style={s.heading}>
          <Text style={s.brand}>Çalışkan <Text style={s.brandLight}>Business</Text></Text>
          <Text style={s.subhead}>App Store İnceleme Modu</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="İnceleme hesabından çıkış yap"
          onPress={onLogout} style={s.logout}><Text style={s.logoutText}>Çıkış</Text></Pressable>
      </View>
      <View style={s.notice}>
        <Text style={s.noticeTitle}>Güvenli örnek çalışma alanı</Text>
        <Text style={s.noticeBody}>
          Bu ekran uygulamanın yönetim arayüzünü örnek kayıtlarla gösterir.
          Tüm veriler temsilîdir. Canlı müşteri, satış, finans veya yönetici verilerine erişilmez.
        </Text>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {section === "dashboard" ? (
          <>
            <Text style={s.title}>Genel Bakış</Text>
            <Text style={s.description}>Sipariş, ürün ve müşteri akışlarının örnek görünümü</Text>
            <View style={s.stats}>
              {[
                ["Örnek Sipariş", "2"],
                ["Örnek Ürün", "2"],
                ["Örnek Müşteri", "2"],
                ["Örnek İade", "0"],
              ].map(([label, value]) => (
                <View key={label} style={s.stat}>
                  <Text style={s.statValue}>{value}</Text>
                  <Text style={s.statLabel}>{label}</Text>
                </View>
              ))}
            </View>
            <Text style={s.sectionTitle}>Hızlı Erişim</Text>
            {sections.filter((item) => item.key !== "dashboard").map((item) => (
              <Pressable key={item.key} onPress={() => changeSection(item.key)} style={s.record}>
                <Text style={s.recordTitle}>{item.label}</Text>
                <Text style={s.recordMeta}>Örnek bölümü görüntüle  ›</Text>
              </Pressable>
            ))}
          </>
        ) : section === "orders" ? (
          <>
            <Text style={s.title}>Sipariş Yönetimi</Text>
            <Text style={s.description}>Örnek siparişler – salt okunur</Text>
            {sampleOrders.map((order) => (
              <Pressable key={order.id} style={s.record}
                onPress={() => setSelected(selected === order.id ? null : order.id)}>
                <Text style={s.recordTitle}>{order.id} · {order.total}</Text>
                <Text style={s.recordMeta}>{order.customer} · {order.status}</Text>
                {selected === order.id ?
                  <Text style={s.detail}>Örnek sipariş detayı: ürün, tutar, ödeme ve sevkiyat takibi. İşlem yapılamaz.</Text>
                  : <Text style={s.hint}>Detayı görüntüle ›</Text>}
              </Pressable>
            ))}
          </>
        ) : section === "products" ? (
          <>
            <Text style={s.title}>Ürün ve Stok</Text>
            <Text style={s.description}>Örnek ürün kartları – salt okunur</Text>
            {sampleProducts.map((product) => (
              <Pressable key={product.sku} style={s.record}
                onPress={() => setSelected(selected === product.sku ? null : product.sku)}>
                <Text style={s.recordTitle}>{product.name}</Text>
                <Text style={s.recordMeta}>Kod: {product.sku} · Stok: {product.stock}</Text>
                {selected === product.sku ?
                  <Text style={s.detail}>Örnek ürün detayı: stok, barkod ve satış durumu. Canlı stok değişmez.</Text>
                  : <Text style={s.hint}>Detayı görüntüle ›</Text>}
              </Pressable>
            ))}
          </>
        ) : section === "customers" ? (
          <>
            <Text style={s.title}>Müşteri Yönetimi</Text>
            <Text style={s.description}>Kişisel bilgi içermeyen örnek kayıtlar</Text>
            {sampleCustomers.map((customer) => (
              <Pressable key={customer.name} style={s.record}
                onPress={() => setSelected(selected === customer.name ? null : customer.name)}>
                <Text style={s.recordTitle}>{customer.name}</Text>
                <Text style={s.recordMeta}>{customer.city} · {customer.status}</Text>
                {selected === customer.name ?
                  <Text style={s.detail}>Örnek cari hesap, sipariş geçmişi ve firma onayı alanları.</Text>
                  : <Text style={s.hint}>Detayı görüntüle ›</Text>}
              </Pressable>
            ))}
          </>
        ) : (
          <>
            <Text style={s.title}>İşletme Modülleri</Text>
            <Text style={s.description}>Uygulamada yer alan yönetim özelliklerinden örnekler</Text>
            {["Bayi Başvuruları", "Stok Raporları", "Satış İadeleri", "Destek Talepleri",
              "Ürün Ekleme ve Barkod", "Bildirimler"].map((item) => (
              <View key={item} style={s.record}>
                <Text style={s.recordTitle}>{item}</Text>
                <Text style={s.recordMeta}>İnceleme hesabında erişim kısıtlı</Text>
              </View>
            ))}
          </>
        )}
        <Text style={s.footer}>Gerçek şirket işlemleri yalnızca yetkilendirilmiş işletme hesaplarıyla yapılabilir.</Text>
      </ScrollView>
      <View style={s.nav}>
        {sections.map((item) => (
          <Pressable key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: section === item.key }}
            onPress={() => changeSection(item.key)}
            style={[s.navButton, section === item.key && s.navActive]}>
            <Text style={[s.navText, section === item.key && s.navTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 18, justifyContent: "space-between" },
  heading: { flex: 1 },
  brand: { fontSize: 23, color: C.text, fontWeight: "700" },
  brandLight: { color: C.muted, fontWeight: "400" },
  subhead: { fontSize: 12, color: C.muted, marginTop: 3 },
  logout: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: "#24303D" },
  logoutText: { color: C.text, fontSize: 13, fontWeight: "600" },
  notice: { marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 15, borderWidth: 1, borderColor: "#475569", backgroundColor: "#1B2531" },
  noticeTitle: { color: "#F8FAFC", fontSize: 14, fontWeight: "700", marginBottom: 4 },
  noticeBody: { color: "#CBD5E1", fontSize: 12, lineHeight: 19 },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 35 },
  title: { color: C.text, fontSize: 24, fontWeight: "700", marginBottom: 5 },
  description: { color: C.muted, fontSize: 13, marginBottom: 18 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  stat: { width: "48%", borderRadius: 15, backgroundColor: "#18212B", padding: 17, borderWidth: 1, borderColor: "#303A45" },
  statValue: { color: C.text, fontSize: 26, fontWeight: "700" },
  statLabel: { color: C.muted, fontSize: 12, marginTop: 5 },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: "700", marginVertical: 10 },
  record: { backgroundColor: "#18212B", borderRadius: 14, borderWidth: 1, borderColor: "#303A45", padding: 16, marginBottom: 10 },
  recordTitle: { color: C.text, fontWeight: "600", fontSize: 15 },
  recordMeta: { color: C.muted, fontSize: 12, marginTop: 6 },
  hint: { color: "#8FBBEF", fontSize: 12, marginTop: 11 },
  detail: { color: "#D6E6F6", fontSize: 13, lineHeight: 20, marginTop: 14 },
  footer: { color: C.muted, fontSize: 11, lineHeight: 18, marginTop: 20, textAlign: "center" },
  nav: { flexDirection: "row", backgroundColor: "#141A21", borderTopWidth: 1, borderTopColor: "#303A45", padding: 8, gap: 5 },
  navButton: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  navActive: { backgroundColor: "#E7E9EB" },
  navText: { color: C.muted, fontSize: 10, fontWeight: "600", textAlign: "center" },
  navTextActive: { color: "#121820" },
});
