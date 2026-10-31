import { useState } from "react";
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import type { BusinessAuthUser } from "../lib/auth";
import { signIn } from "../lib/auth";

const INK="#081421",YELLOW="#FFCC00",MUTED="#617084",BORDER="#DEE5EF";

export function LoginScreen({
  background,onSuccess,
}:{
  background?:string|null;
  onSuccess:(user:BusinessAuthUser)=>void;
}){
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [visible,setVisible]=useState(false);
  const [focused,setFocused]=useState<"email"|"password"|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  const submit=async()=>{
    const address=email.trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)||!password){
      setMessage("Geçerli e-posta adresinizi ve şifrenizi girin.");
      return;
    }
    if(busy)return;
    setBusy(true);setMessage("");
    try {
      const session=await signIn(address,password);
      onSuccess(session.user);
    }catch(error){
      setMessage(error instanceof Error?error.message:"Giriş yapılamadı. Yeniden deneyin.");
    }finally{setBusy(false);}
  };

  return <SafeAreaView style={s.safe} edges={["top","bottom"]}>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==="ios"?"padding":"height"}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"
        bounces={false} keyboardDismissMode={Platform.OS==="ios"?"interactive":"on-drag"}>
        <View style={s.brandRow}>
          <View style={s.brandMark}><Ionicons name="business-outline" size={24} color={INK}/></View>
          <View>
            <Text style={s.brandName}>ÇALIŞKAN <Text style={s.brandAccent}>BUSINESS</Text></Text>
            <Text style={s.brandCaption}>İşletme yönetim platformu</Text>
          </View>
        </View>

        <View style={s.hero}>
          {background?<Image source={{uri:background}} style={StyleSheet.absoluteFill}
            resizeMode="cover" accessibilityIgnoresInvertColors/>:null}
          <View style={s.heroScrim}/>
          <View style={s.heroPill}>
            <Ionicons name="shield-checkmark-outline" size={15} color={INK}/>
            <Text style={s.heroPillText}>GÜVENLİ TEDARİKÇİ ERİŞİMİ</Text>
          </View>
          <Text style={s.heroTitle}>İşinizin kontrolü{"\n"}
            <Text style={s.heroTitleAccent}>her an elinizde.</Text>
          </Text>
          <Text style={s.heroSubtitle}>Siparişler, ürünler ve mağaza işlemleri tek merkezde.</Text>
        </View>

        <View style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.title}>Hesabınıza Giriş Yapın</Text>
            <Text style={s.subtitle}>Tedarikçi veya yönetici giriş bilgilerinizi kullanın.</Text>
          </View>
          <Text style={s.label}>E-posta Adresi</Text>
          <View style={[s.inputRow,focused==="email"&&s.inputFocused]}>
            <Ionicons name="mail-outline" color={focused==="email"?INK:MUTED} size={21}/>
            <TextInput accessibilityLabel="E-posta adresi" style={s.input}
              placeholder="ornek@firma.com" placeholderTextColor="#8C98A8"
              autoCapitalize="none" autoCorrect={false}
              keyboardType="email-address" textContentType="username" autoComplete="email"
              returnKeyType="next" value={email} onChangeText={setEmail}
              onFocus={()=>setFocused("email")} onBlur={()=>setFocused(null)}/>
          </View>
          <Text style={s.label}>Şifre</Text>
          <View style={[s.inputRow,focused==="password"&&s.inputFocused]}>
            <Ionicons name="lock-closed-outline" color={focused==="password"?INK:MUTED} size={21}/>
            <TextInput accessibilityLabel="Şifre" style={s.input} placeholder="Şifreniz"
              placeholderTextColor="#8C98A8" secureTextEntry={!visible}
              textContentType="password" autoComplete="password"
              autoCapitalize="none" autoCorrect={false}
              value={password} onChangeText={setPassword}
              onFocus={()=>setFocused("password")} onBlur={()=>setFocused(null)}
              onSubmitEditing={()=>void submit()} returnKeyType="go"/>
            <TouchableOpacity accessibilityRole="button"
              accessibilityLabel={visible?"Şifreyi gizle":"Şifreyi göster"}
              style={s.eye} onPress={()=>setVisible(value=>!value)}>
              <Ionicons name={visible?"eye-off-outline":"eye-outline"} color={MUTED} size={21}/>
            </TouchableOpacity>
          </View>
          {message?<View style={s.errorBox} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" color="#B42318" size={18}/>
            <Text style={s.errorText}>{message}</Text>
          </View>:null}
          <TouchableOpacity style={[s.submit,busy&&{opacity:0.65}]} onPress={()=>void submit()}
            disabled={busy} accessibilityRole="button" accessibilityLabel="Giriş yap">
            {busy?<ActivityIndicator color={INK}/>:<Ionicons name="log-in-outline" size={21} color={INK}/>}
            <Text style={s.submitText}>{busy?"Giriş doğrulanıyor…":"Giriş Yap"}</Text>
            {!busy?<Ionicons name="arrow-forward" size={19} color={INK}/>:null}
          </TouchableOpacity>
          <View style={s.helpRow}>
            <Ionicons name="information-circle-outline" color={MUTED} size={17}/>
            <Text style={s.helpText}>
              İlk giriş şifrenizi henüz belirlemediyseniz Çalışkan B2B web hesabınızdan tamamlayın.
            </Text>
          </View>
        </View>
        <Text style={s.footer}>ÇALIŞKAN BUSINESS · Güvenli işletme erişimi</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:"#F5F7FB"},
  scroll:{flexGrow:1,paddingHorizontal:17,paddingTop:14,paddingBottom:30,gap:16},
  brandRow:{flexDirection:"row",alignItems:"center",gap:11,paddingVertical:7},
  brandMark:{width:43,height:43,borderRadius:13,backgroundColor:YELLOW,
    alignItems:"center",justifyContent:"center"},
  brandName:{fontSize:15,fontWeight:"900",color:INK,letterSpacing:0.4},
  brandAccent:{color:"#A06B00"},
  brandCaption:{fontSize:11,color:MUTED,marginTop:3},
  hero:{backgroundColor:INK,borderRadius:25,paddingHorizontal:21,paddingTop:27,
    paddingBottom:27,minHeight:200,overflow:"hidden",justifyContent:"flex-end",gap:13},
  heroScrim:{...StyleSheet.absoluteFill,backgroundColor:"rgba(5,13,25,0.82)"},
  heroPill:{alignSelf:"flex-start",flexDirection:"row",alignItems:"center",gap:6,
    borderRadius:20,paddingVertical:6,paddingHorizontal:10,backgroundColor:YELLOW},
  heroPillText:{fontSize:9,fontWeight:"900",letterSpacing:0.35,color:INK},
  heroTitle:{fontWeight:"900",fontSize:30,lineHeight:35,color:"#FFFFFF",letterSpacing:-0.7},
  heroTitleAccent:{color:YELLOW},
  heroSubtitle:{fontSize:12,lineHeight:18,color:"#E3E9EF",maxWidth:290},
  card:{backgroundColor:"#FFFFFF",borderRadius:23,borderColor:BORDER,borderWidth:1,
    padding:19,paddingBottom:22,shadowColor:INK,shadowOpacity:0.06,shadowRadius:15,
    shadowOffset:{width:0,height:6},elevation:2},
  cardHead:{marginBottom:21},
  title:{color:INK,fontWeight:"900",fontSize:22,letterSpacing:-0.5},
  subtitle:{color:MUTED,fontSize:12,marginTop:8,lineHeight:18},
  label:{color:INK,fontWeight:"800",fontSize:12,marginBottom:9},
  inputRow:{borderColor:BORDER,borderWidth:1,borderRadius:14,backgroundColor:"#FAFBFD",
    minHeight:53,paddingLeft:14,paddingRight:7,flexDirection:"row",gap:10,
    alignItems:"center",marginBottom:17},
  inputFocused:{borderColor:"#D29D00",backgroundColor:"#FFFDF5"},
  input:{flex:1,minWidth:0,fontSize:15,color:INK,paddingVertical:10},
  eye:{width:40,height:43,alignItems:"center",justifyContent:"center"},
  submit:{borderRadius:15,backgroundColor:YELLOW,minHeight:55,flexDirection:"row",
    alignItems:"center",justifyContent:"center",gap:11,marginTop:2},
  submitText:{color:INK,fontWeight:"900",fontSize:15},
  helpRow:{flexDirection:"row",gap:8,marginTop:18,alignItems:"flex-start"},
  helpText:{fontSize:11,lineHeight:16,color:MUTED,flex:1},
  errorBox:{flexDirection:"row",gap:8,backgroundColor:"#FFF1F0",borderRadius:11,
    padding:11,marginBottom:13,alignItems:"flex-start"},
  errorText:{flex:1,color:"#B42318",fontSize:12,lineHeight:18},
  footer:{textAlign:"center",color:"#98A3B3",fontSize:10,letterSpacing:0.7,marginTop:2},
});
