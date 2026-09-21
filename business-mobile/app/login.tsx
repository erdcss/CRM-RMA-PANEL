import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function BusinessLogin() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>Yönetici Girişi</Text>
        <Text style={styles.description}>
          Bu ekran web admin panelinden atanan Çalışkan Business hesaplarına bağlanacak altyapı noktasıdır.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B0B0B" },
  content: { flex: 1, justifyContent: "center", padding: 28, gap: 12 },
  title: { color: "#FFFFFF", fontSize: 28, fontWeight: "700" },
  description: { color: "#B8B8B8", fontSize: 16, lineHeight: 24 }
});
