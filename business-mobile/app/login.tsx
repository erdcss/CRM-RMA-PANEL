import { useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { signIn } from "../lib/auth";
import { useMobileBranding } from "../lib/branding";

export default function BusinessLogin() {
  const router = useRouter();
  const branding = useMobileBranding();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setMessage("E-posta ve şifrenizi eksiksiz girin.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      await signIn(normalizedEmail, password);
      router.replace("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Giriş başarısız");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {branding.business_mobile_logo ? (
            <Image source={{ uri: branding.business_mobile_logo }} style={s.logo} resizeMode="contain" />
          ) : null}
          <Text style={s.title}>Çalışkan Business</Text>

          <Text style={s.label}>E-posta</Text>
          <TextInput
            style={s.input}
            placeholder="ornek@firma.com"
            placeholderTextColor="#777"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="email"
            returnKeyType="next"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <Text style={s.label}>Şifre</Text>
          <View style={s.passwordWrap}>
            <TextInput
              ref={passwordRef}
              style={s.passwordInput}
              placeholder="Şifrenizi girin"
              placeholderTextColor="#777"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              autoComplete="password"
              returnKeyType="go"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={submit}
            />
            <TouchableOpacity
              style={s.eyeButton}
              onPress={() => setShowPassword((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            >
              <Text style={s.eyeText}>{showPassword ? "Gizle" : "Göster"}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[s.button, busy && s.buttonBusy]} disabled={busy} onPress={submit}>
            <Text style={s.buttonText}>{busy ? "Giriş yapılıyor…" : "Giriş Yap"}</Text>
          </TouchableOpacity>
          {!!message && <Text style={s.message}>{message}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B0B0B" },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: 28, paddingBottom: 36 },
  logo: { width: 112, height: 112, alignSelf: "center", marginBottom: 20 },
  title: { color: "#FFF", fontSize: 28, fontWeight: "700", marginBottom: 28, textAlign: "center" },
  label: { color: "#E8E8E8", fontSize: 14, fontWeight: "600", marginBottom: 8 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    paddingHorizontal: 14,
    color: "#FFF",
    fontSize: 16,
    backgroundColor: "#111",
    marginBottom: 16,
  },
  passwordWrap: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    backgroundColor: "#111",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  passwordInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 14, color: "#FFF", fontSize: 16 },
  eyeButton: { paddingHorizontal: 14, paddingVertical: 14 },
  eyeText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  button: { backgroundColor: "#FFF", minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  buttonBusy: { opacity: 0.65 },
  buttonText: { color: "#111", fontWeight: "700", fontSize: 16 },
  message: { color: "#FFB4B4", marginTop: 12, lineHeight: 20 },
});
