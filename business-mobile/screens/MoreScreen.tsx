import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { BusinessAuthUser } from "../lib/auth";
import { C } from "../ui/theme";
import { PageHeader, SectionTitle } from "./common";

export function MoreScreen({
  user,
  onSupport,
  onModule,
  onLogout,
}: {
  user: BusinessAuthUser | null;
  onSupport: () => void;
  onModule: (slug: string) => void;
  onLogout: () => void | Promise<void>;
}) {
  const email = user?.email || user?.username || "Yönetici";

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <PageHeader title="Daha Fazla" subtitle="Tüm yönetim araçlarına buradan erişin." />

      <View style={s.profile}>
        <View style={s.avatar}><Text style={s.avatarText}>{email.slice(0,1).toUpperCase()}</Text></View>
        <View style={s.profileMain}>
          <Text style={s.profileTitle}>Yönetici hesabı</Text>
          <Text style={s.profileSub}>{email}</Text>
        </View>
      </View>

      <SectionTitle title="Operasyon" />
      <MenuCard title="Destek Merkezi" subtitle="Müşteri talepleri ve mesajlar" onPress={onSupport} />
      <MenuCard title="İade İşlemleri" subtitle="İade ve onay süreçleri" onPress={() => onModule("iade-islemleri")} />
      <MenuCard title="Stok Durumu" subtitle="Kritik stok ve ürün kontrolü" onPress={() => onModule("stok-durumu")} />
      <MenuCard title="Başvurular" subtitle="B2B müşteri başvuruları" onPress={() => onModule("basvurular")} />

      <SectionTitle title="Yönetim" />
      <MenuCard title="Ayarlar" subtitle="Marka, logo ve uygulama ayarları" onPress={() => onModule("ayarlar")} />
      <MenuCard title="Yöneticiler" subtitle="Kullanıcı ve yetki yönetimi" onPress={() => onModule("yoneticiler")} />
      <MenuCard title="Faturalar" subtitle="Fatura kayıtları" onPress={() => onModule("faturalar")} />
      <MenuCard title="Tedarikçiler" subtitle="Tedarikçi yönetimi" onPress={() => onModule("tedarikciler")} />

      <TouchableOpacity style={s.logout} onPress={() => void onLogout()}>
        <Text style={s.logoutText}>Çıkış Yap</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function MenuCard({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.menuCard} onPress={onPress} activeOpacity={0.74}>
      <View style={s.menuMain}>
        <Text style={s.menuTitle}>{title}</Text>
        <Text style={s.menuSub}>{subtitle}</Text>
      </View>
      <Text style={s.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 118 },
  profile: {
    minHeight: 84,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: C.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#9FC0FF", fontSize: 20, fontWeight: "600" },
  profileMain: { flex: 1, paddingLeft: 12 },
  profileTitle: { color: C.text, fontSize: 14, fontWeight: "600" },
  profileSub: { color: C.muted, fontSize: 11, marginTop: 5 },
  menuCard: {
    minHeight: 72,
    marginBottom: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  menuMain: { flex: 1 },
  menuTitle: { color: C.text, fontSize: 14, fontWeight: "600" },
  menuSub: { color: C.muted, fontSize: 10, marginTop: 5 },
  chevron: { color: C.text2, fontSize: 26 },
  logout: {
    minHeight: 54,
    marginTop: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(251,113,133,0.35)",
    backgroundColor: C.redSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: { color: C.red, fontSize: 14, fontWeight: "600" },
});
