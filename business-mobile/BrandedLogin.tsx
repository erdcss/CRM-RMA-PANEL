import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Image, ImageBackground, Keyboard, KeyboardAvoidingView,
  Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signIn, type BusinessAuthUser } from "./lib/auth";

const YELLOW = "#FFCC12";
type Field = "email" | "password";

export default function BrandedLogin({ logo, background, onSuccess }: {
  logo?: string | null;
  background?: string | null;
  onSuccess: (user: BusinessAuthUser) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState<Field | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const input = useRef<TextInput>(null);
  const rise = useRef(new Animated.Value(0)).current;
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  useEffect(() => {
    Animated.spring(rise, {
      toValue: active ? 1 : 0, useNativeDriver: true, damping: 24, stiffness: 200,
    }).start();
    if (active) {
      const timer = setTimeout(() => input.current?.focus(), 220);
      return () => clearTimeout(timer);
    }
  }, [active, rise]);

  function close() {
    Keyboard.dismiss();
    setActive(null);
  }

  async function submit() {
    const normalized = email.trim().toLowerCase();
    if (!validEmail) {
      setMessage("Geçerli bir e-posta adresi girin.");
      setActive("email");
      return;
    }
    if (!password) {
      setMessage("Şifrenizi girin.");
      setActive("password");
      return;
    }
    close();
    setBusy(true);
    setMessage("");
    try {
      const session = await signIn(normalized, password);
      onSuccess(session.user);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Giriş başarısız.");
    } finally {
      setBusy(false);
    }
  }

  const scene = background
    ? <ImageBackground source={{ uri: background }} resizeMode="cover" style={StyleSheet.absoluteFill} />
    : <View style={[StyleSheet.absoluteFill, styles.fallback]} />;

  return (
    <View style={styles.screen}>
      {scene}
      <View style={styles.scrim} />
      <SafeAreaView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandTop}>
            {logo ? <Image source={{ uri: logo }} resizeMode="contain" style={styles.logo} /> : <Text style={styles.brand}>ÇALIŞKAN B2B</Text>}
          </View>
          <View style={styles.spacer} />
          <View style={styles.chips}>
            <Text style={styles.chip}>▣  Geniş Ürün Yelpazesi</Text>
            <Text style={styles.chip}>▰  Hızlı Tedarik</Text>
          </View>
          <View style={styles.panel}>
            <Text style={styles.title}>Hoş <Text style={styles.yellow}>Geldiniz</Text></Text>
            <Text style={styles.subtitle}>Çalışkan B2B platformuna giriş yaparak işinizi daha ileriye taşıyın.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Kullanıcı adı veya e-posta gir" style={styles.field} onPress={() => setActive("email")}>
              <Text style={styles.fieldIcon}>✉</Text>
              <Text numberOfLines={1} style={[styles.fieldText, !email && styles.placeholder]}>{email || "Kullanıcı Adı veya E-posta"}</Text>
              {validEmail ? <Text style={styles.yellow}>✓</Text> : null}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Şifre gir" style={styles.field} onPress={() => setActive("password")}>
              <Text style={styles.fieldIcon}>♙</Text>
              <Text style={[styles.fieldText, !password && styles.placeholder]}>{password ? (visible ? password : "••••••••") : "Şifre"}</Text>
              <Text style={styles.yellow}>{password ? "✓" : ""}</Text>
            </Pressable>
            <View style={styles.options}>
              <TouchableOpacity onPress={() => setRemember(v => !v)} accessibilityRole="checkbox" accessibilityState={{checked:remember}}>
                <Text style={styles.optionText}><Text style={styles.yellow}>{remember ? "☑" : "□"}</Text>  Beni hatırla</Text>
              </TouchableOpacity>
              <Text style={styles.yellow}>Şifremi unuttum?</Text>
            </View>
            <TouchableOpacity style={styles.loginButton} disabled={busy} onPress={() => void submit()}>
              {busy ? <ActivityIndicator color="#0B0B0B" /> : <Text style={styles.loginLabel}>Giriş Yap  →</Text>}
            </TouchableOpacity>
            <Text style={styles.or}>veya</Text>
            <TouchableOpacity style={styles.registerButton} onPress={() => setMessage("İşletme kayıt bağlantısı henüz tanımlanmamış.")}>
              <Text style={styles.registerText}>▣  İşletmemi Kaydet</Text>
            </TouchableOpacity>
            {message ? <Text style={styles.error}>{message}</Text> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
      {active ? (
        <View style={styles.overlay}>
          {background ? <ImageBackground source={{uri:background}} blurRadius={18} resizeMode="cover" style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, styles.fallback]} />}
          <View style={styles.overlayDim} />
          <Pressable style={styles.overlayTap} onPress={close} accessibilityLabel="Düzenlemeyi kapat" />
          <KeyboardAvoidingView pointerEvents="box-none" style={styles.overlayKeyboard} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <Animated.View style={[styles.focusPanel, {
              opacity: rise,
              transform: [{translateY:rise.interpolate({inputRange:[0,1],outputRange:[130,0]})}],
            }]}>
              <View style={styles.handle} />
              <Text style={styles.focusIcon}>{active === "email" ? "✉" : "♙"}</Text>
              <Text style={styles.focusTitle}>{active === "email" ? "E-posta Adresiniz" : "Şifreniz"}</Text>
              <Text style={styles.focusHint}>{active === "email" ? "Hesabınıza giriş yapmak için kayıtlı e-posta adresinizi girin." : "Hesabınızın şifresini güvenle girin."}</Text>
              <View style={styles.focusInputWrap}>
                <TextInput
                  ref={input}
                  style={styles.focusInput}
                  placeholder={active === "email" ? "ornek@eposta.com" : "Şifrenizi girin"}
                  placeholderTextColor="#888"
                  value={active === "email" ? email : password}
                  onChangeText={active === "email" ? setEmail : setPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType={active === "email" ? "email-address" : "default"}
                  secureTextEntry={active === "password" && !visible}
                  autoComplete={active === "email" ? "email" : "password"}
                  returnKeyType="done"
                  onSubmitEditing={close}
                />
                {active === "email" && validEmail ? <Text style={styles.yellow}>✓</Text> : null}
                {active === "password" ? <TouchableOpacity onPress={() => setVisible(v => !v)}><Text style={styles.yellow}>{visible ? "Gizle" : "Göster"}</Text></TouchableOpacity> : null}
              </View>
              <TouchableOpacity onPress={close} style={styles.done}><Text style={styles.doneText}>Tamam</Text></TouchableOpacity>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex:{flex:1},screen:{flex:1,backgroundColor:"#0B0B0B"},fallback:{backgroundColor:"#191919"},
  scrim:{...StyleSheet.absoluteFillObject,backgroundColor:"rgba(0,0,0,0.32)"},
  content:{flexGrow:1,paddingHorizontal:20,paddingBottom:25},
  brandTop:{alignItems:"center",paddingTop:42},logo:{width:220,height:85},brand:{fontWeight:"900",fontSize:32,color:"#FFF"},
  spacer:{flexGrow:1,minHeight:100},chips:{flexDirection:"row",justifyContent:"space-around",marginBottom:20},
  chip:{color:YELLOW,fontSize:11,fontWeight:"700"},panel:{borderColor:"rgba(255,204,18,.5)",borderWidth:1,borderRadius:25,backgroundColor:"rgba(7,9,11,.94)",padding:22},
  title:{color:"#FFF",fontWeight:"900",fontSize:32},yellow:{color:YELLOW,fontWeight:"700"},subtitle:{color:"#B7B7B7",lineHeight:20,marginTop:8,marginBottom:22,fontSize:13},
  field:{minHeight:55,borderWidth:1,borderColor:"#555",backgroundColor:"#1B1B1B",borderRadius:12,marginBottom:12,flexDirection:"row",alignItems:"center",paddingHorizontal:15},
  fieldIcon:{color:YELLOW,fontSize:23,marginRight:14},fieldText:{color:"#FFF",fontSize:15,flex:1},placeholder:{color:"#999"},
  options:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginVertical:14},optionText:{color:"#FFF",fontSize:12},
  loginButton:{height:54,borderRadius:12,backgroundColor:YELLOW,justifyContent:"center",alignItems:"center",marginTop:6},
  loginLabel:{color:"#0B0B0B",fontSize:19,fontWeight:"900"},or:{textAlign:"center",color:"#9E9E9E",marginVertical:13},
  registerButton:{height:51,borderRadius:12,borderColor:YELLOW,borderWidth:1,alignItems:"center",justifyContent:"center"},
  registerText:{color:"#FFF",fontSize:15,fontWeight:"700"},error:{color:"#FF9999",fontSize:12,marginTop:12},
  overlay:{...StyleSheet.absoluteFillObject,zIndex:50},overlayDim:{...StyleSheet.absoluteFillObject,backgroundColor:"rgba(0,0,0,.55)"},
  overlayTap:{...StyleSheet.absoluteFillObject},overlayKeyboard:{flex:1,justifyContent:"flex-end"},
  focusPanel:{backgroundColor:"rgba(15,16,17,.97)",borderTopLeftRadius:26,borderTopRightRadius:26,borderWidth:1,borderColor:"#57503C",paddingHorizontal:24,paddingBottom:22,paddingTop:10},
  handle:{alignSelf:"center",width:50,height:5,borderRadius:4,backgroundColor:"#999",marginBottom:21},
  focusIcon:{fontSize:27,color:YELLOW,textAlign:"center"},focusTitle:{color:"#FFF",fontWeight:"900",fontSize:26,textAlign:"center",marginTop:12},
  focusHint:{color:"#BBB",fontSize:14,lineHeight:21,textAlign:"center",marginTop:7,marginBottom:19},
  focusInputWrap:{minHeight:57,borderRadius:12,borderWidth:2,borderColor:YELLOW,paddingHorizontal:14,alignItems:"center",flexDirection:"row",backgroundColor:"#212121"},
  focusInput:{color:"#FFF",fontSize:16,flex:1,paddingVertical:14},done:{alignSelf:"flex-end",paddingTop:14,paddingBottom:3,paddingHorizontal:4},
  doneText:{color:YELLOW,fontWeight:"800",fontSize:15},
});
