import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ImageBackground,
  Keyboard,
  TextInput,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { FormField } from '@/components/forms/FormField';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { useAuth } from '@/contexts/AuthContext';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { useMobileBranding } from '@/lib/branding';
import { appAlert } from '@/lib/appAlert';

export default function LoginScreen() {
  const branding = useMobileBranding();
  const router = useRouter();
  const { session, signIn, completeInitialPassword, forgotPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeField, setActiveField] = useState<'email' | 'password' | null>(null);
  const inputRef = useRef<TextInput>(null);
  const floatAnim = useRef(new Animated.Value(0)).current;
  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());
  useEffect(() => {
    Animated.timing(floatAnim,{toValue:activeField ? 1 : 0,duration:260,useNativeDriver:true}).start();
    if(activeField){const t=setTimeout(()=>inputRef.current?.focus(),290);return ()=>clearTimeout(t);}
  },[activeField,floatAnim]);
  const dismissField = () => { Keyboard.dismiss();setActiveField(null); };


  const [passwordSetupVisible, setPasswordSetupVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordAgain, setNewPasswordAgain] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (session?.user?.mustChangePassword) {
      setPasswordSetupVisible(true);
    }
  }, [session?.user?.mustChangePassword]);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      appAlert('Eksik bilgi', 'E-posta ve şifre girin.');
      return;
    }

    setSubmitting(true);
    try {
      const session = await signIn(email, password);

      if (session.user.mustChangePassword) {
        setPassword('');
        setPasswordSetupVisible(true);
        return;
      }

      router.replace('/(tabs)');
    } catch (error) {
      appAlert(
        'Giriş başarısız',
        error instanceof Error ? error.message : 'E-posta veya şifre hatalı.',
        undefined,
        'error',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const saveInitialPassword = async () => {
    if (newPassword.length < 8) {
      appAlert('Şifre çok kısa', 'Yeni şifre en az 8 karakter olmalıdır.');
      return;
    }
    if (newPassword !== newPasswordAgain) {
      appAlert('Şifreler eşleşmiyor', 'Yeni şifre ve tekrarı aynı olmalıdır.');
      return;
    }

    setSavingPassword(true);
    try {
      await completeInitialPassword(newPassword, newPasswordAgain);
      setPasswordSetupVisible(false);
      setNewPassword('');
      setNewPasswordAgain('');
      appAlert('Şifreniz oluşturuldu', 'Çalışkan B2B hesabınız kullanıma hazır.');
      router.replace('/(tabs)');
    } catch (error) {
      appAlert(
        'Şifre oluşturulamadı',
        error instanceof Error ? error.message : 'Lütfen tekrar deneyin.',
      );
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <View style={styles.heroScreen}>
      {branding.b2b_mobile_splash ? <ImageBackground source={{uri:branding.b2b_mobile_splash}} resizeMode="cover" style={StyleSheet.absoluteFillObject}/> : <View style={[StyleSheet.absoluteFillObject,{backgroundColor:'#171717'}]}/>}
      <View style={styles.heroShade}/>
      <ScrollView contentContainerStyle={styles.heroContent} keyboardShouldPersistTaps="handled">
        <BrandLogo uri={branding.b2b_mobile_logo} style={styles.heroLogo}/>
        <View style={{flexGrow:1,minHeight:130}}/>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Hoş <Text style={{color:'#FFCC00'}}>Geldiniz</Text></Text>
          <Text style={styles.heroSubtitle}>Çalışkan B2B platformuna giriş yaparak işinizi daha ileriye taşıyın.</Text>
          <Pressable style={styles.heroField} onPress={()=>setActiveField('email')} accessibilityLabel="E-posta adresi">
            <Ionicons name="mail-outline" size={21} color="#FFCC00"/>
            <Text style={[styles.heroFieldText,!email&&{color:'#999'}]} numberOfLines={1}>{email||'Kullanıcı Adı veya E-posta'}</Text>
            {validEmail?<Ionicons name="checkmark-circle" size={19} color="#FFCC00"/>:null}
          </Pressable>
          <Pressable style={styles.heroField} onPress={()=>setActiveField('password')} accessibilityLabel="Şifre">
            <Ionicons name="lock-closed-outline" size={21} color="#FFCC00"/>
            <Text style={[styles.heroFieldText,!password&&{color:'#999'}]}>{password?(showPassword?password:'••••••••'):'Şifre'}</Text>
          </Pressable>
          <Pressable style={{alignSelf:'flex-end',paddingVertical:12}} onPress={async()=>{
            if(!validEmail){appAlert('E-posta gerekli','Şifre yenilemek için e-posta adresinizi girin.');setActiveField('email');return;}
            try{const result=await forgotPassword(email);appAlert('Şifre yenileme',result.message||'E-postanızı kontrol edin.');}
            catch(error){appAlert('Şifre yenilenemedi',error instanceof Error?error.message:'Lütfen tekrar deneyin.');}
          }}><Text style={{color:'#FFCC00',fontWeight:'700'}}>Şifremi Unuttum</Text></Pressable>
          <Pressable style={[styles.heroPrimary,submitting&&styles.disabled]} onPress={handleLogin} disabled={submitting}>
            <Text style={styles.heroPrimaryText}>{submitting?'Giriş yapılıyor…':'Giriş Yap  →'}</Text>
          </Pressable>
          <Text style={{color:'#AAA',textAlign:'center',marginVertical:13}}>veya</Text>
          <Pressable style={styles.heroSecondary} onPress={()=>router.push('/signup')}>
            <Ionicons name="business-outline" size={20} color="#FFCC00"/>
            <Text style={{color:'#FFF',fontWeight:'800',fontSize:16}}>İşletmemi Kaydet</Text>
          </Pressable>
        </View>
      </ScrollView>
      {activeField?(
        <View style={styles.focusOverlay}>
          {branding.b2b_mobile_splash?<ImageBackground source={{uri:branding.b2b_mobile_splash}} blurRadius={20} resizeMode="cover" style={StyleSheet.absoluteFillObject}/>:<View style={[StyleSheet.absoluteFillObject,{backgroundColor:'#151515'}]}/>}
          <View style={styles.focusDim}/>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={dismissField}/>
          <KeyboardAvoidingView style={{flex:1,justifyContent:'flex-end'}} behavior={Platform.OS==='ios'?'padding':'height'}>
            <Animated.View style={[styles.focusSheet,{opacity:floatAnim,transform:[{translateY:floatAnim.interpolate({inputRange:[0,1],outputRange:[120,0]})}]}]}>
              <View style={styles.focusHandle}/>
              <Ionicons name={activeField==='email'?'mail-outline':'lock-closed-outline'} size={28} color="#FFCC00" style={{alignSelf:'center'}}/>
              <Text style={styles.focusTitle}>{activeField==='email'?'E-posta Adresiniz':'Şifreniz'}</Text>
              <Text style={styles.focusHint}>{activeField==='email'?'Hesabınıza giriş yapmak için kayıtlı e-posta adresinizi girin.':'Hesabınıza giriş yapmak için şifrenizi girin.'}</Text>
              <View style={styles.focusInputRow}>
                <TextInput key={activeField} ref={inputRef} style={styles.focusInput} value={activeField==='email'?email:password}
                  onChangeText={activeField==='email'?setEmail:setPassword} placeholder={activeField==='email'?'ornek@eposta.com':'Şifrenizi girin'}
                  placeholderTextColor="#888" keyboardType={activeField==='email'?'email-address':'default'}
                  autoCapitalize="none" autoCorrect={false} autoComplete={activeField==='email'?'email':'password'}
                  secureTextEntry={activeField==='password'&&!showPassword} returnKeyType="done" onSubmitEditing={dismissField}/>
                {activeField==='email'&&validEmail?<Ionicons name="checkmark-circle" size={21} color="#FFCC00"/>:null}
                {activeField==='password'?<Pressable onPress={()=>setShowPassword(v=>!v)}><Ionicons name={showPassword?'eye-off-outline':'eye-outline'} size={23} color="#FFCC00"/></Pressable>:null}
              </View>
              <Pressable onPress={dismissField} style={{alignSelf:'flex-end',padding:12}}><Text style={{color:'#FFCC00',fontWeight:'800'}}>Tamam</Text></Pressable>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      ):null}
      <Modal
        visible={passwordSetupVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => undefined}
      >
        <KeyboardAvoidingView
          style={styles.modalScreen}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalIcon}>
              <Ionicons name="key-outline" size={30} color="#FFFFFF" />
            </View>
            <Text style={styles.modalTitle}>Yeni şifrenizi oluşturun</Text>
            <Text style={styles.modalSubtitle}>
              Yönetici onayından sonra gönderilen tek kullanımlık şifre yalnızca ilk giriş içindir.
              Devam etmek için en az 8 karakterli kalıcı şifrenizi belirleyin.
            </Text>

            <FormField
              label="Yeni Şifre"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNewPassword}
              placeholder="En az 8 karakter"
              rightSlot={
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowNewPassword((current) => !current)}
                >
                  <Ionicons
                    name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textMuted}
                  />
                </Pressable>
              }
            />

            <FormField
              label="Yeni Şifre Tekrar"
              value={newPasswordAgain}
              onChangeText={setNewPasswordAgain}
              secureTextEntry={!showNewPassword}
              placeholder="Şifrenizi tekrar girin"
            />

            <Pressable
              style={[styles.primaryButton, savingPassword && styles.disabled]}
              onPress={saveInitialPassword}
              disabled={savingPassword}
            >
              <Ionicons name="checkmark-circle-outline" size={19} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>
                {savingPassword ? 'Kaydediliyor…' : 'Şifremi Oluştur'}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  heroScreen:{flex:1,backgroundColor:'#101010'},
  heroShade:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,.38)'},
  heroContent:{flexGrow:1,paddingHorizontal:20,paddingTop:58,paddingBottom:38},
  heroLogo:{width:240,height:90,alignSelf:'center'},
  heroCard:{borderRadius:25,borderWidth:1,borderColor:'rgba(255,204,0,.6)',backgroundColor:'rgba(10,10,10,.94)',padding:22},
  heroTitle:{fontSize:32,fontWeight:'900',color:'#FFF'},
  heroSubtitle:{color:'#C8C8C8',fontSize:14,lineHeight:21,marginTop:8,marginBottom:21},
  heroField:{height:56,borderRadius:12,borderWidth:1,borderColor:'#555',backgroundColor:'#1A1A1A',flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:14,marginBottom:12},
  heroFieldText:{flex:1,fontSize:15,color:'#FFF'},
  heroPrimary:{height:54,borderRadius:12,backgroundColor:'#FFCC00',alignItems:'center',justifyContent:'center'},
  heroPrimaryText:{fontWeight:'900',fontSize:18,color:'#101010'},
  heroSecondary:{height:52,borderRadius:12,borderWidth:1,borderColor:'#FFCC00',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},
  focusOverlay:{...StyleSheet.absoluteFillObject,zIndex:40},
  focusDim:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,.6)'},
  focusSheet:{borderTopLeftRadius:27,borderTopRightRadius:27,borderWidth:1,borderColor:'#60512A',backgroundColor:'rgba(16,17,18,.98)',paddingHorizontal:24,paddingTop:10,paddingBottom:12},
  focusHandle:{width:48,height:5,borderRadius:4,backgroundColor:'#999',alignSelf:'center',marginBottom:22},
  focusTitle:{fontSize:26,fontWeight:'900',color:'#FFF',textAlign:'center',marginTop:12},
  focusHint:{color:'#CCC',fontSize:14,lineHeight:21,textAlign:'center',marginTop:8,marginBottom:20},
  focusInputRow:{minHeight:58,borderRadius:12,borderWidth:2,borderColor:'#FFCC00',backgroundColor:'#222',flexDirection:'row',alignItems:'center',paddingHorizontal:14},
  focusInput:{flex:1,color:'#FFF',fontSize:16,paddingVertical:14},

  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  back: {
    minHeight: minTouchTarget,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  backText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  card: {
    marginTop: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  brandRow: {
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    width: 150,
    height: 44,
  },
  customerLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  form: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.text,
    fontWeight: '900',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: -spacing.sm,
  },
  eyeButton: {
    position: 'absolute',
    right: spacing.md,
    top: 12,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '800',
  },
  quickEntry: {
    minHeight: 70,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  quickText: {
    flex: 1,
  },
  quickTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '700',
  },
  quickSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  helpButton: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  helpText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  disabled: {
    opacity: 0.6,
  },
  modalScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalContent: {
    flexGrow: 1,
    padding: spacing.xxl,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    ...typography.largeTitle,
    color: colors.text,
    fontWeight: '900',
  },
  modalSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
