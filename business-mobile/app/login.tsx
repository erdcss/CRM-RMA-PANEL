import { useState } from "react";
import { useRouter } from "expo-router";
import { Image, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { signIn } from "../lib/auth";
import { useMobileBranding } from "../lib/branding";

export default function BusinessLogin() {
  const router = useRouter();
  const branding = useMobileBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      await signIn(email.trim(), password);
      setMessage("Giriş başarılı.");
      router.replace("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Giriş başarısız");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.content}>
        {branding.business_mobile_logo ? (
          <Image source={{ uri: branding.business_mobile_logo }} style={s.logo} resizeMode="contain" />
        ) : null}
        <Text style={s.title}>Yönetici Girişi</Text>
        <Text style={s.description}>
          Web yönetim panelinden oluşturulan Çalışkan Business hesabınızla giriş yapın.
        </Text>
        <TextInput
          style={s.input}
          placeholder="E-posta"
          placeholderTextColor="#777"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={s.input}
          placeholder="Şifre"
          placeholderTextColor="#777"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity style={s.button} disabled={busy} onPress={submit}>
          <Text style={s.buttonText}>{busy ? "Giriş yapılıyor…" : "Giriş Yap"}</Text>
        </TouchableOpacity>
        {!!message && <Text style={s.message}>{message}</Text>}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B0B0B" },
  content: { flex: 1, justifyContent: "center", padding: 28, gap: 12 },
  logo: { width: 112, height: 112, alignSelf: "center", marginBottom: 8 },
  title: { color: "#FFF", fontSize: 28, fontWeight: "700" },
  description: { color: "#B8B8B8", fontSize: 16, lineHeight: 24 },
  input: { borderWidth: 1, borderColor: "#333", borderRadius: 12, padding: 14, color: "#FFF", fontSize: 16 },
  button: { backgroundColor: "#FFF", padding: 15, borderRadius: 12, alignItems: "center" },
  buttonText: { color: "#111", fontWeight: "700" },
  message: { color: "#B8B8B8", marginTop: 4 },
});
