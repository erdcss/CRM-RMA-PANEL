import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { appAlert } from '@/lib/appAlert';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { forgotPassword } = useAuth();

  const send = async () => {
    const address = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      appAlert('Geçersiz e-posta', 'Hesabınızda kullanılan e-posta adresini girin.', undefined, 'error');
      return;
    }
    if (pending || submitted) return;
    setPending(true);
    try {
      await forgotPassword(address);
      setSubmitted(true);
    } catch (error) {
      appAlert('Şifre sıfırlanamadı', error instanceof Error ? error.message : 'Lütfen tekrar deneyin.', undefined, 'error');
    } finally {
      setPending(false);
    }
  };
  return <View style={styles.root}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#FFCD00" />
          <Text style={{ color:'#FFCD00',fontWeight:'700' }}>Giriş ekranına dön</Text>
        </Pressable>
        <View style={styles.icon}><Ionicons name="key-outline" size={30} color="#FFCD00" /></View>
        <Text style={styles.heading}>Şifremi Unuttum</Text>
        <Text style={styles.subtitle}>Çalışkan B2B hesabının kayıtlı e-posta adresini yaz. Hesap uygunsa tek kullanımlık şifre e-posta adresine gönderilir.</Text>
        <Text style={styles.label}>E-posta adresi</Text>
        <View style={styles.inputRow}>
          <Ionicons name="mail-outline" size={19} color="#FFCD00" />
          <TextInput value={email} onChangeText={setEmail} editable={!pending && !submitted}
            style={styles.input} placeholder="ornek@firma.com" placeholderTextColor="#B7BCC5"
            autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" returnKeyType="done"
            onSubmitEditing={() => void send()} />
        </View>
        <Pressable style={[styles.submit, (pending || submitted) && { opacity:0.6 }]} disabled={pending || submitted} onPress={() => void send()}>
          <Text style={styles.submitText}>{pending ? 'Gönderiliyor…' : submitted ? 'Talep gönderildi' : 'Yeni Şifre İste'}</Text>
        </Pressable>
        {submitted ? <View style={styles.notice}>
          <Ionicons name="checkmark-circle-outline" size={21} color="#FFCD00" />
          <Text style={styles.noticeText}>Hesap uygunsa yeni giriş şifresi gönderilir. Spam klasörünü de kontrol et. E-postayı alamazsan destek merkezi üzerinden yardım iste.</Text>
        </View> : null}
        <Text style={styles.helper}>Yeni tek kullanımlık şifreyle giriş yaptığında kalıcı şifre oluşturma ekranı açılır.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex:1,backgroundColor:'#0E1013' },
  content: { flexGrow:1,paddingHorizontal:24,paddingTop:42,paddingBottom:38,justifyContent:'center' },
  back: { flexDirection:'row',alignItems:'center',gap:9,marginBottom:25,minHeight:44 },
  icon:{width:62,height:62,backgroundColor:'#22252A',borderRadius:17,alignItems:'center',justifyContent:'center',marginBottom:23},
  heading:{fontSize:29,color:'#FFFFFF',fontWeight:'900'},
  subtitle:{color:'#D0D5DC',fontSize:14,lineHeight:22,marginTop:10,marginBottom:30},
  label:{color:'#FFFFFF',fontSize:13,fontWeight:'700',marginBottom:9},
  inputRow:{height:56,borderRadius:12,backgroundColor:'#202328',borderWidth:1,borderColor:'#656D7A',paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:12},
  input:{flex:1,color:'#FFFFFF',fontSize:16,height:'100%'},
  submit:{height:52,borderRadius:12,backgroundColor:'#FFCD00',marginTop:19,alignItems:'center',justifyContent:'center'},
  submitText:{color:'#131313',fontSize:16,fontWeight:'900'},
  notice:{marginTop:20,flexDirection:'row',gap:10,padding:14,borderRadius:12,backgroundColor:'#23251E'},
  noticeText:{color:'#F3F4F5',fontSize:13,lineHeight:20,flex:1},
  helper:{color:'#B8C0CC',fontSize:12,lineHeight:19,marginTop:24},
});
