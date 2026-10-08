import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { BusinessAuthUser } from "../lib/auth";
import { signIn } from "../lib/auth";
import { WarehouseBackdrop } from "../components/WarehouseBackdrop";
import { C } from "../ui/theme";

export function LoginScreen({
  background,
  onSuccess,
}: {
  background?: string | null;
  onSuccess: (user: BusinessAuthUser) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<"email" | "password" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const focusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: focused ? 1 : 0,
      duration: focused ? 260 : 220,
      useNativeDriver: true,
    }).start();
  }, [focused, focusAnim]);

  const submit = async () => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !password) {
      setMessage("E-posta ve şifrenizi eksiksiz girin.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const session = await signIn(normalized, password);
      onSuccess(session.user);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Giriş başarısız");
    } finally {
      setBusy(false);
    }
  };

  const formStyle = {
    transform: [
      {
        translateY: focusAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -118],
        }),
      },
    ],
  };

  const backdropStyle = {
    transform: [
      {
        scale: focusAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.06],
        }),
      },
    ],
    opacity: focusAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0.72],
    }),
  };

  return (
    <View style={s.screen}>
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        {background ? (
          <Image
            source={{ uri: background }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            blurRadius={focused ? 18 : 2}
          />
        ) : (
          <WarehouseBackdrop dimmed={Boolean(focused)} />
        )}
        <View style={s.backdropShade} />
      </Animated.View>

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          bounces={false}
        >
          <View style={s.topSpacer} />

          <Animated.View style={[s.panel, formStyle]}>
            <Text style={s.title}>
              Çalışkan <Text style={s.titleLight}>Business</Text>
            </Text>
            <Text style={s.subtitle}>İşinizi her yerden yönetin.</Text>

            <View style={[s.inputShell, focused === "email" && s.inputFocused]}>
              <Text style={s.inputIcon}>✉</Text>
              <TextInput
                style={s.input}
                placeholder="E-posta"
                placeholderTextColor="#737D89"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="username"
                autoComplete="email"
                returnKeyType="next"
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
              />
            </View>

            <View style={[s.inputShell, focused === "password" && s.inputFocused]}>
              <Text style={s.inputIcon}>▣</Text>
              <TextInput
                style={s.input}
                placeholder="Şifre"
                placeholderTextColor="#737D89"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                autoComplete="password"
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
              />
              <TouchableOpacity
                style={s.showButton}
                onPress={() => setShowPassword((value) => !value)}
              >
                <Text style={s.showText}>{showPassword ? "Gizle" : "Göster"}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[s.loginButton, busy && s.disabled]}
              activeOpacity={0.84}
              disabled={busy}
              onPress={() => void submit()}
            >
              <Text style={s.loginButtonText}>
                {busy ? "Giriş yapılıyor..." : "Giriş Yap"}
              </Text>
              <Text style={s.loginArrow}>→</Text>
            </TouchableOpacity>

            {message ? <Text style={s.error}>{message}</Text> : null}

            <View style={s.securityRow}>
              <Text style={s.securityIcon}>◇</Text>
              <Text style={s.securityText}>Güvenli yönetim deneyimi</Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  backdropShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,5,8,0.34)",
  },
  content: {
    flexGrow: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 18,
    paddingBottom: 26,
  },
  topSpacer: { minHeight: 360, flexGrow: 1 },
  panel: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(5,9,13,0.92)",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.62,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
  },
  title: {
    color: C.text,
    fontSize: 32,
    fontWeight: "650",
    textAlign: "center",
    letterSpacing: -1,
  },
  titleLight: { fontWeight: "300", color: "#C8CDD4" },
  subtitle: {
    marginTop: 8,
    marginBottom: 24,
    color: C.muted,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "400",
  },
  inputShell: {
    minHeight: 58,
    marginBottom: 13,
    paddingHorizontal: 15,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#303A45",
    backgroundColor: "rgba(19,25,32,0.90)",
    flexDirection: "row",
    alignItems: "center",
  },
  inputFocused: {
    borderColor: "rgba(255,255,255,0.38)",
    backgroundColor: "rgba(23,30,38,0.97)",
  },
  inputIcon: {
    color: "#A9B1BC",
    fontSize: 18,
    width: 28,
  },
  input: {
    flex: 1,
    minHeight: 56,
    color: C.text,
    fontSize: 16,
    fontWeight: "400",
  },
  showButton: {
    paddingHorizontal: 6,
    paddingVertical: 12,
  },
  showText: {
    color: "#B7BEC8",
    fontSize: 12,
    fontWeight: "500",
  },
  loginButton: {
    minHeight: 58,
    marginTop: 5,
    borderRadius: 17,
    backgroundColor: "#F2F3F5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonText: {
    color: "#080B0F",
    fontSize: 17,
    fontWeight: "650",
  },
  loginArrow: {
    color: "#080B0F",
    fontSize: 25,
    marginLeft: 12,
    marginTop: -2,
  },
  disabled: { opacity: 0.58 },
  error: {
    marginTop: 12,
    color: "#FDA4AF",
    fontSize: 13,
    textAlign: "center",
  },
  securityRow: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  securityIcon: {
    color: "#737D89",
    fontSize: 16,
    marginRight: 8,
  },
  securityText: {
    color: "#737D89",
    fontSize: 12,
    fontWeight: "400",
  },
});
