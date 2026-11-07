import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Alert, Platform } from 'react-native';

// Only non-identifying app-event names are sent. No user IDs, names, tax data,
// phone numbers, advertising ID, or order totals are passed to Meta here.
const CONSENT_KEY = 'caliskan_b2b_meta_app_events_consent_v1';
const isConfigured = () =>
  Platform.OS === 'ios' &&
  Constants.executionEnvironment !== 'storeClient' &&
  Constants.expoConfig?.extra?.appVariant !== 'development' &&
  Boolean(process.env.EXPO_PUBLIC_META_CLIENT_TOKEN);

type MetaSdk = typeof import('react-native-fbsdk-next');
let sdk: MetaSdk | null = null;
let enabled = false;
let promptHandled = false;
let initializePromise: Promise<boolean> | null = null;

async function initializeMeta(): Promise<boolean> {
  if (!isConfigured()) return false;
  if (enabled) return true;
  if (initializePromise) return initializePromise;

  initializePromise = (async () => {
    try {
      const module = await import('react-native-fbsdk-next');
      // No IDFA collection and no implicit SDK event logging.
      await module.Settings.setAdvertiserIDCollectionEnabled(false);
      await module.Settings.setAutoLogAppEventsEnabled(false);
      module.Settings.initializeSDK();
      sdk = module;
      enabled = true;
      return true;
    } catch (error) {
      console.warn('[meta-app-events] SDK init skipped:', error);
      return false;
    } finally {
      initializePromise = null;
    }
  })();

  return initializePromise;
}

export async function getMetaEventsConsent(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CONSENT_KEY)) === 'granted';
  } catch {
    return false;
  }
}

export async function setMetaEventsConsent(value: boolean): Promise<void> {
  await AsyncStorage.setItem(CONSENT_KEY, value ? 'granted' : 'denied');
  if (value) {
    await initializeMeta();
  } else {
    enabled = false;
    // Revocation prevents our explicit events; native auto-logging remains disabled.
    if (sdk) {
      await sdk.Settings.setAutoLogAppEventsEnabled(false);
      await sdk.Settings.setAdvertiserIDCollectionEnabled(false);
    }
  }
}

export async function logMetaAppEvent(
  eventName: string,
  params?: Record<string, string | number>,
): Promise<void> {
  if (!enabled || !sdk || !eventName) return;
  try {
    if (params) sdk.AppEventsLogger.logEvent(eventName, params);
    else sdk.AppEventsLogger.logEvent(eventName);
    // Send manual events promptly so Test Events can verify the native connection.
    sdk.AppEventsLogger.flush();
  } catch (error) {
    console.warn('[meta-app-events] Event skipped:', error);
  }
}

export async function requestMetaEventsConsentOnce(): Promise<void> {
  if (!isConfigured() || promptHandled) return;
  promptHandled = true;
  try {
    const choice = await AsyncStorage.getItem(CONSENT_KEY);
    if (choice === 'granted') {
      if (await initializeMeta()) await logMetaAppEvent('fb_mobile_activate_app');
      return;
    }
    if (choice === 'denied') return;

    Alert.alert(
      'İsteğe bağlı kullanım ölçümü',
      'Uygulama açılışı ve bazı ürün/başvuru işlemlerinin ölçüm bilgilerini Meta ile paylaşmamıza izin verir misiniz? Reklamlarımızı geliştirmek için kullanılır. Ad, telefon, vergi numarası ve ödeme detaylarını olaylara eklemiyoruz; Meta teknik cihaz ve bağlantı verilerini işleyebilir. Tercihinizi Ayarlar bölümünden değiştirebilirsiniz.',
      [
        { text: 'Şimdi Değil', style: 'cancel', onPress: () => { void setMetaEventsConsent(false); } },
        {
          text: 'İzin Ver',
          onPress: () => {
            void setMetaEventsConsent(true).then(() => logMetaAppEvent('fb_mobile_activate_app'));
          },
        },
      ],
      { cancelable: false },
    );
  } catch (error) {
    console.warn('[meta-app-events] Consent read failed:', error);
  }
}


// Explicit, user-triggered, non-identifying test event. This only proves that
// the native SDK accepted a send attempt, not that Meta received it.
export async function runMetaConnectionTest(): Promise<'no_consent' | 'unavailable' | 'submitted'> {
  if (!(await getMetaEventsConsent())) return 'no_consent';
  if (!(await initializeMeta()) || !sdk) return 'unavailable';
  try {
    sdk.AppEventsLogger.logEvent('b2b_meta_connection_test');
    sdk.AppEventsLogger.flush();
    return 'submitted';
  } catch (error) {
    console.warn('[meta-app-events] Diagnostic event failed:', error);
    return 'unavailable';
  }
}
