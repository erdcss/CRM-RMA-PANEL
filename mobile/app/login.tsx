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
import Constants from 'expo-constants';

import { FormField } from '@/components/forms/FormField';
import { useAuth } from '@/contexts/AuthContext';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { useMobileBranding } from '@/lib/branding';
import { appAlert } from '@/lib/appAlert';

export default function LoginScreen() {
  const branding = useMobileBranding();
  const installedRevision = String(Constants.expoConfig?.extra?.sourceRevision || 'eski-build');
  const router = useRouter();
  const { session, signIn, completeInitialPassword, forgotPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formTranslate = useRef(new Animated.Value(14)).current;
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const keyboardLift = useRef(new Animated.Value(0)).current;
  const [androidKeyboardOpen, setAndroidKeyboardOpen] = useState(false);
  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  useEffect(() => {
    Animated.parallel([
      Animated.timing(formOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(formTranslate, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [formOpacity, formTranslate]);

  // Android resizes the available viewport above the keyboard. Animate the
  // card's final lift, and scroll it into view on short displays.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => {
      setAndroidKeyboardOpen(true);
      Animated.spring(keyboardLift, {
        toValue: -12,
        damping: 19,
        stiffness: 190,
        mass: 0.85,
        useNativeDriver: true,
      }).start();
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setAndroidKeyboardOpen(false);
      Animated.spring(keyboardLift, {
        toValue: 0,
        damping: 19,
        stiffness: 190,
        mass: 0.85,
        useNativeDriver: true,
      }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, [keyboardLift]);

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
      {branding.b2b_mobile_login_background ? <ImageBackground source={{uri:branding.b2b_mobile_login_background}} resizeMode="cover" style={StyleSheet.absoluteFillObject}/> : <View style={[StyleSheet.absoluteFillObject,{backgroundColor:'#171717'}]}/>}
      <View style={styles.heroShade}/>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.heroContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={[styles.heroSpacer, androidKeyboardOpen && styles.heroSpacerKeyboard]} />
          <Animated.View style={[styles.heroCard, { opacity: formOpacity, transform: [{ translateY: Animated.add(formTranslate, keyboardLift) }] }]}>
            <Text style={styles.heroTitle}>Hoş <Text style={styles.heroAccent}>Geldiniz</Text></Text>
            <Text style={styles.heroSubtitle}>Çalışkan B2B platformuna giriş yaparak işinizi daha ileriye taşıyın.</Text>

            <Text style={styles.fieldLabel}>E-posta Adresi</Text>
            <View style={styles.heroField}>
              <Ionicons name="mail-outline" size={21} color="#FFCC00" />
              <TextInput
                ref={emailRef}
                style={styles.fieldInput}
                value={email}
                onChangeText={setEmail}
                placeholder="ornek@eposta.com"
                placeholderTextColor="#929292"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="username"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                accessibilityLabel="E-posta adresi"
              />
              <View style={styles.fieldAccessory}>
                {validEmail ? <Ionicons name="checkmark-circle" size={20} color="#FFCC00" /> : null}
              </View>
            </View>

            <Text style={styles.fieldLabel}>Şifre</Text>
            <View style={styles.heroField}>
              <Ionicons name="lock-closed-outline" size={21} color="#FFCC00" />
              <TextInput
                ref={passwordRef}
                style={styles.fieldInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Şifrenizi girin"
                placeholderTextColor="#929292"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={() => { Keyboard.dismiss(); void handleLogin(); }}
                accessibilityLabel="Şifre"
              />
              <Pressable
                style={styles.fieldAccessory}
                onPress={() => setShowPassword((value) => !value)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                hitSlop={6}
              >
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color="#FFCC00" />
              </Pressable>
            </View>

            <Pressable
              style={styles.forgotButton}
              onPress={() => router.push({ pathname: '/forgot-password', params: { email: email.trim() } } as never)}
              accessibilityRole="button"
            >
              <Text style={styles.forgotText}>Şifremi Unuttum</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.heroPrimary, submitting && styles.disabled, pressed && styles.buttonPressed]}
              onPress={() => { Keyboard.dismiss(); void handleLogin(); }}
              disabled={submitting}
              accessibilityRole="button"
            >
              <Text style={styles.heroPrimaryText}>{submitting ? 'Giriş yapılıyor…' : 'Giriş Yap  →'}</Text>
            </Pressable>
            <Text style={styles.separatorText}>veya</Text>
            <Pressable
              style={({ pressed }) => [styles.heroSecondary, pressed && styles.buttonPressed]}
              onPress={() => { Keyboard.dismiss(); router.push('/signup'); }}
              accessibilityRole="button"
            >
              <Ionicons name="business-outline" size={20} color="#FFCC00" />
              <Text style={styles.registerText}>İşletmemi Kaydet</Text>
            </Pressable>
            <Text selectable style={styles.buildMark}>Kod: {installedRevision}</Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex:{flex:1},
  heroSpacer:{flexGrow:1,minHeight:72},
  heroSpacerKeyboard:{minHeight:10},
  heroAccent:{color:'#FFCC00'},
  fieldLabel:{color:'#E9E9E9',fontSize:13,fontWeight:'700',marginBottom:8},
  fieldInput:{flex:1,minWidth:0,fontSize:16,color:'#FFFFFF',height:'100%',paddingVertical:0},
  fieldAccessory:{width:36,height:44,alignItems:'center',justifyContent:'center'},
  forgotButton:{alignSelf:'flex-end',paddingVertical:12,minHeight:44,justifyContent:'center'},
  forgotText:{color:'#FFCC00',fontWeight:'700'},
  separatorText:{color:'#AAAAAA',textAlign:'center',marginVertical:13},
  registerText:{color:'#FFFFFF',fontWeight:'800',fontSize:16},
  buttonPressed:{opacity:0.82,transform:[{scale:0.985}]},
  heroScreen:{flex:1,backgroundColor:'#101010'},
  heroShade:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,.38)'},
  heroContent:{flexGrow:1,paddingHorizontal:20,paddingTop:40,paddingBottom:38},
  heroCard:{borderRadius:25,borderWidth:1,borderColor:'rgba(255,204,0,.6)',backgroundColor:'rgba(10,10,10,.94)',padding:22},
  heroTitle:{fontSize:32,fontWeight:'900',color:'#FFF'},
  heroSubtitle:{color:'#C8C8C8',fontSize:14,lineHeight:21,marginTop:8,marginBottom:21},
  heroField:{height:56,borderRadius:12,borderWidth:1,borderColor:'#646464',backgroundColor:'#1A1A1A',flexDirection:'row',alignItems:'center',gap:10,paddingLeft:14,paddingRight:8,marginBottom:12},
  heroFieldText:{flex:1,fontSize:15,color:'#FFF'},
  heroPrimary:{height:54,borderRadius:12,backgroundColor:'#FFCC00',alignItems:'center',justifyContent:'center'},
  heroPrimaryText:{fontWeight:'900',fontSize:18,color:'#101010'},
  heroSecondary:{height:52,borderRadius:12,borderWidth:1,borderColor:'#FFCC00',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},
  buildMark:{color:'#A8A8A8',fontSize:10,textAlign:'center',marginTop:12},
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
