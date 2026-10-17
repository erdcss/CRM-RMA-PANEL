import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppearance } from '@/contexts/AppearanceContext';
import { Ionicons } from '@expo/vector-icons';

import { colors, minTouchTarget, radius, shadows, spacing, typography } from '@/constants/theme';

export type AlertTone = 'success' | 'error' | 'warning' | 'info';

export type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type AlertState = {
  visible: boolean;
  title: string;
  message?: string;
  tone: AlertTone;
  buttons: AlertButton[];
  toast: boolean;
  sequence: number;
};

type AlertContextValue = {
  showAlert: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    tone?: AlertTone,
  ) => void;
};

const AlertContext = createContext<AlertContextValue | null>(null);

const toneConfig: Record<
  AlertTone,
  { icon: keyof typeof Ionicons.glyphMap; bg: string; color: string }
> = {
  success: { icon: 'checkmark-circle', bg: colors.successSoft, color: colors.success },
  error: { icon: 'close-circle', bg: colors.dangerSoft, color: colors.danger },
  warning: { icon: 'warning', bg: colors.warningSoft, color: colors.warning },
  info: { icon: 'information-circle', bg: colors.primarySoft, color: colors.primary },
};

function inferTone(title: string, message?: string): AlertTone {
  const text = `${title} ${message ?? ''}`.toLowerCase();
  if (/başarı|kaydedildi|doğruland|hazır|bağland|kapatıld|tamamland|oluşturuldu/.test(text)) return 'success';
  if (/hata|başarısız|bulunamad|geçersiz|eklenemedi|çıkarılamad|kapatılamad|doğrulama|yazdırılamad|kopyalanamad|açılamad|yapılamad/.test(text)) {
    return 'error';
  }
  if (/uyarı|eşleşmedi|sığm|bilgi/.test(text)) return 'warning';
  return 'info';
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const insets=useSafeAreaInsets();
  const {palette:appPalette}=useAppearance();
  const slide=useRef(new Animated.Value(360)).current;
  const [state, setState] = useState<AlertState>({
    visible: false,
    title: '',
    tone: 'info',
    buttons: [],
    toast: false,
    sequence:0,
  });

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const showAlert = useCallback(
    (title: string, message?: string, buttons?: AlertButton[], tone?: AlertTone) => {
      const resolvedButtons =
        buttons && buttons.length > 0 ? buttons : [{ text: 'Tamam', style: 'default' as const }];
      setState(previous=>({
        visible: true,
        title,
        message,
        tone: tone ?? inferTone(title, message),
        buttons: resolvedButtons,
        toast: !buttons || buttons.length===0,
        sequence:previous.sequence+1,
      }));
    },
    [],
  );

  useEffect(()=>{
    if(!state.visible || !state.toast)return;
    slide.setValue(360);
    const enter=Animated.timing(slide,{toValue:0,duration:300,easing:Easing.out(Easing.cubic),useNativeDriver:true});
    enter.start();
    const timer=setTimeout(()=>{
      Animated.timing(slide,{toValue:360,duration:260,easing:Easing.in(Easing.cubic),useNativeDriver:true})
        .start(({finished})=>{if(finished)setState(current=>current.sequence===state.sequence?{...current,visible:false}:current);});
    },2900);
    return()=>{clearTimeout(timer);slide.stopAnimation();};
  },[state.visible,state.toast,state.sequence,slide]);

  const value = useMemo(() => ({ showAlert }), [showAlert]);
  const palette = toneConfig[state.tone];

  const handlePress = (button: AlertButton) => {
    close();
    button.onPress?.();
  };

  return (
    <AlertContext.Provider value={value}>
      {children}
      {state.visible && state.toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.toastPosition,{top:insets.top+10,transform:[{translateX:slide}]}]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={state.title+'. Bildirimi kapat'}
            accessibilityLiveRegion="polite"
            onPress={close}
            style={[styles.toastCard,{backgroundColor:appPalette.surface,borderColor:appPalette.border}]}
          >
            <Ionicons name={palette.icon} size={21} color={palette.color}/>
            <View style={{flex:1,minWidth:0}}>
              <Text numberOfLines={1} style={[styles.toastTitle,{color:appPalette.text}]}>{state.title}</Text>
              {state.message ? <Text numberOfLines={2} style={[styles.toastMessage,{color:appPalette.textSecondary}]}>{state.message}</Text> : null}
            </View>
            <Ionicons name="close" size={17} color={appPalette.textSecondary}/>
          </Pressable>
        </Animated.View>
      ) : null}
      <Modal visible={state.visible && !state.toast} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={[styles.iconWrap, { backgroundColor: palette.bg }]}>
              <Ionicons name={palette.icon} size={28} color={palette.color} />
            </View>
            <Text style={styles.title}>{state.title}</Text>
            {state.message ? <Text style={styles.message}>{state.message}</Text> : null}
            <View style={styles.actions}>
              {state.buttons.map((button, index) => {
                const destructive = button.style === 'destructive';
                const cancel = button.style === 'cancel';
                return (
                  <Pressable
                    key={`${button.text}-${index}`}
                    style={[
                      styles.button,
                      destructive && styles.buttonDestructive,
                      cancel && styles.buttonCancel,
                      !destructive && !cancel && styles.buttonPrimary,
                      state.buttons.length === 1 && styles.buttonFull,
                    ]}
                    onPress={() => handlePress(button)}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        destructive && styles.buttonTextDestructive,
                        cancel && styles.buttonTextCancel,
                        !destructive && !cancel && styles.buttonTextPrimary,
                      ]}
                    >
                      {button.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
}

export function useAppAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAppAlert must be used within AlertProvider');
  return ctx;
}

const styles = StyleSheet.create({
  toastPosition:{position:'absolute',right:12,zIndex:9998,width:'92%',maxWidth:380,alignSelf:'flex-end',elevation:30},
  toastCard:{minHeight:53,borderWidth:1,borderLeftWidth:3,borderLeftColor:'#FFCD00',borderRadius:13,paddingVertical:10,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:10,shadowColor:'#000',shadowOpacity:0.14,shadowRadius:11,shadowOffset:{width:0,height:4},elevation:10},
  toastTitle:{fontSize:13,fontWeight:'900'},
  toastMessage:{fontSize:11,marginTop:2,lineHeight:16},
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.subtitle, color: colors.text, textAlign: 'center' },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    width: '100%',
    marginTop: spacing.xs,
  },
  button: {
    flex: 1,
    minWidth: 120,
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  buttonFull: { flexBasis: '100%' },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonDestructive: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: '#FECACA' },
  buttonCancel: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  buttonText: { ...typography.bodyMedium, fontWeight: '700' },
  buttonTextPrimary: { color: colors.surface },
  buttonTextDestructive: { color: colors.danger },
  buttonTextCancel: { color: colors.textSecondary },
});
