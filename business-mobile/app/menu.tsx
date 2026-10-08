import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ADMIN_MODULE_GROUPS } from "../lib/admin-modules";
import { getBusinessSession, signOut } from "../lib/auth";

export default function BusinessMenu() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getBusinessSession().then((session) => {
      if (!session) router.replace("/login");
      else setReady(true);
    });
  }, [router]);

  if (!ready) return <View style={s.screen} />;

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>‹</Text></TouchableOpacity>
        <View style={s.headerText}>
          <Text style={s.title}>Tüm Modüller</Text>
          <Text style={s.subtitle}>Çalışkan Admin ile aynı yönetim başlıkları</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {ADMIN_MODULE_GROUPS.map((group) => (
          <View key={group.title} style={s.group}>
            <Text style={s.groupTitle}>{group.title}</Text>
            {group.items.map((item) => (
              <TouchableOpacity
                key={item.slug}
                style={s.row}
                activeOpacity={0.75}
                onPress={() => item.route ? router.push(item.route as any) : router.push({ pathname: "/module/[slug]", params: { slug: item.slug } } as any)}
              >
                <View style={s.rowText}>
                  <Text style={s.rowTitle}>{item.title}</Text>
                  <Text style={s.rowDescription}>{item.description}</Text>
                </View>
                <Text style={s.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        <TouchableOpacity
          style={s.logout}
          onPress={async () => {
            await signOut();
            router.replace("/login");
          }}
        >
          <Text style={s.logoutText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8F9FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#E2E5E9", backgroundColor: "#FFF" },
  back: { fontSize: 36, color: "#1D4ED8", lineHeight: 38 },
  headerText: { flex: 1 },
  title: { fontSize: 22, fontWeight: "800", color: "#18212F" },
  subtitle: { marginTop: 2, color: "#667085", fontSize: 12 },
  content: { padding: 16, paddingBottom: 40 },
  group: { marginBottom: 22 },
  groupTitle: { fontSize: 12, fontWeight: "800", color: "#667085", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 },
  row: { minHeight: 72, padding: 14, borderWidth: 1, borderColor: "#E2E5E9", borderRadius: 14, backgroundColor: "#FFF", marginBottom: 8, flexDirection: "row", alignItems: "center" },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: "700", color: "#18212F" },
  rowDescription: { fontSize: 12, color: "#667085", marginTop: 4 },
  chevron: { fontSize: 28, color: "#98A2B3" },
  logout: { marginTop: 10, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: "#D92D20" },
  logoutText: { color: "#D92D20", fontWeight: "800" },
});
