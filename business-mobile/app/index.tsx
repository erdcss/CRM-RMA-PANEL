import { Link } from "expo-router";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function BusinessHome() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>ÇALIŞKAN GROUP</Text>
        <Text style={styles.title}>Çalışkan Business</Text>
        <Text style={styles.description}>
          Yönetici mobil uygulaması altyapısı hazır. Operasyon özellikleri sonraki geliştirme komutlarıyla eklenecek.
        </Text>
        <Link href="/login" style={styles.link}>Yönetici girişi</Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B0B0B" },
  content: { flex: 1, justifyContent: "center", padding: 28, gap: 14 },
  eyebrow: { color: "#8C8C8C", fontSize: 12, letterSpacing: 2 },
  title: { color: "#FFFFFF", fontSize: 34, fontWeight: "700" },
  description: { color: "#B8B8B8", fontSize: 16, lineHeight: 24 },
  link: { marginTop: 10, color: "#FFFFFF", fontSize: 16, fontWeight: "600" }
});
