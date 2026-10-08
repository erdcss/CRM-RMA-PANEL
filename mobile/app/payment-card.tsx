import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ExpoLinking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { appAlert } from '@/lib/appAlert';
import { clearOrderList } from '@/lib/b2b-order-list';

function loadWebView() {
  try {
    const module = require('react-native-webview') as {
      WebView?: React.ComponentType<any>;
    };
    return module.WebView || null;
  } catch {
    return null;
  }
}

function isTrustedCheckoutUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && host.endsWith('.iyzipay.com');
  } catch {
    return false;
  }
}

export default function PaymentCardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: string;
    url?: string;
    order?: string;
    storageKey?: string;
    clearList?: string;
  }>();

  const mode = String(params.mode || '');
  const initialUrl = String(params.url || '');
  const orderNumber = String(params.order || '');
  const storageKey = String(params.storageKey || '');
  const shouldClearList = String(params.clearList || '') === '1';

  const WebView = useMemo(() => loadWebView(), []);
  const [threeDSHtml, setThreeDSHtml] = useState('');
  const [loadingHtml, setLoadingHtml] = useState(mode === '3ds');
  const [loadingPage, setLoadingPage] = useState(true);
  const [failed, setFailed] = useState(false);

  const safeUrl = useMemo(() => {
    if (mode === '3ds') return '';
    if (!isTrustedCheckoutUrl(initialUrl)) return '';

    try {
      const url = new URL(initialUrl);
      url.searchParams.set('iframe', 'true');
      return url.toString();
    } catch {
      return '';
    }
  }, [initialUrl, mode]);

  useEffect(() => {
    if (mode !== '3ds') return;

    let active = true;

    void (async () => {
      try {
        if (!storageKey) {
          throw new Error('3D Secure oturumu bulunamadı.');
        }

        const html = await AsyncStorage.getItem(storageKey);
        if (!active) return;

        if (!html?.trim()) {
          throw new Error('3D Secure doğrulama içeriği bulunamadı veya süresi doldu.');
        }

        setThreeDSHtml(html);
      } catch (error) {
        if (!active) return;
        setFailed(true);
        appAlert(
          '3D Secure açılamadı',
          error instanceof Error ? error.message : 'Doğrulama ekranı hazırlanamadı.',
          undefined,
          'error',
        );
      } finally {
        if (active) setLoadingHtml(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [mode, storageKey]);

  const completeFromDeepLink = async (url: string) => {
    const parsed = ExpoLinking.parse(url);
    const query = parsed.queryParams || {};
    const result = typeof query.result === 'string' ? query.result : 'failed';
    const order =
      typeof query.order === 'string' && query.order
        ? query.order
        : orderNumber;
    const stock = typeof query.stock === 'string' ? query.stock : undefined;

    if (storageKey) {
      await AsyncStorage.removeItem(storageKey).catch(() => undefined);
    }
    if (result === 'success' && shouldClearList) {
      await clearOrderList().catch(() => undefined);
    }

    router.replace({
      pathname: '/payment-result',
      params: {
        result,
        order,
        ...(stock ? { stock } : {}),
      },
    } as never);
  };

  if (!WebView) {
    return (
      <Screen>
        <View style={styles.center}>
          <View style={styles.errorIcon}>
            <Ionicons name="build-outline" size={34} color="#FFFFFF" />
          </View>
          <Text style={styles.errorTitle}>
            Kart ödeme modülü bu development build içinde yok
          </Text>
          <Text style={styles.errorText}>
            3D Secure doğrulamasını uygulama içinde açmak için güncel iOS development build kurulmalıdır.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Ödeme Sayfasına Dön</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const hasContent =
    mode === '3ds'
      ? Boolean(threeDSHtml.trim())
      : Boolean(safeUrl);

  if (loadingHtml) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.text} />
          <Text style={styles.loaderText}>3D Secure hazırlanıyor…</Text>
        </View>
      </Screen>
    );
  }

  if (!hasContent || failed) {
    return (
      <Screen>
        <View style={styles.center}>
          <View style={styles.errorIcon}>
            <Ionicons name="close" size={34} color="#FFFFFF" />
          </View>
          <Text style={styles.errorTitle}>3D Secure ekranı açılamadı</Text>
          <Text style={styles.errorText}>
            Ödeme oturumu geçersiz veya süresi dolmuş olabilir. Kart bilgilerinizi kontrol edip yeniden deneyin.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Ödeme Sayfasına Dön</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={21} color={colors.text} />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.title}>3D Secure Doğrulama</Text>
            <Text style={styles.subtitle}>
              Bankanızın güvenli doğrulama ekranı
            </Text>
          </View>

          <View style={styles.secureBadge}>
            <Ionicons name="shield-checkmark" size={16} color={colors.success} />
          </View>
        </View>

        <View style={styles.securityBar}>
          <Ionicons
            name="lock-closed-outline"
            size={17}
            color={colors.textSecondary}
          />
          <Text style={styles.securityText}>
            Bankanızdan gelen doğrulama kodunu bu ekranda girin. İşlem tamamlandığında sipariş sonucu otomatik açılır.
          </Text>
        </View>

        <View style={styles.webviewWrap}>
          {loadingPage ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={colors.text} />
              <Text style={styles.loaderText}>Banka doğrulama ekranı yükleniyor…</Text>
            </View>
          ) : null}

          <WebView
            source={
              mode === '3ds'
                ? {
                    html: threeDSHtml,
                    baseUrl: 'https://b2b.ecalisgan.com',
                  }
                : { uri: safeUrl }
            }
            style={styles.webview}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            setSupportMultipleWindows={false}
            mixedContentMode="never"
            originWhitelist={[
              'https://*',
              'about:blank',
              'data:*',
              'caliskanb2b://*',
              'caliskanb2b-dev://*',
            ]}
            onLoadStart={() => setLoadingPage(true)}
            onLoadEnd={() => setLoadingPage(false)}
            onError={() => {
              setLoadingPage(false);
              setFailed(true);
            }}
            onShouldStartLoadWithRequest={(request: { url: string }) => {
              const target = request.url;

              if (
                target.startsWith('caliskanb2b://payment-result') ||
                target.startsWith('caliskanb2b-dev://payment-result')
              ) {
                void completeFromDeepLink(target);
                return false;
              }

              if (
                target.startsWith('https://') ||
                target === 'about:blank' ||
                target.startsWith('data:')
              ) {
                return true;
              }

              appAlert(
                'Bağlantı engellendi',
                '3D Secure sırasında güvenli olmayan bir yönlendirme engellendi.',
                undefined,
                'warning',
              );
              return false;
            }}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    minHeight: 66,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSecondary,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
    fontWeight: '900',
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  secureBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityBar: {
    minHeight: 54,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  securityText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 17,
  },
  webviewWrap: {
    flex: 1,
    margin: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
  },
  loaderText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  errorIcon: {
    width: 68,
    height: 68,
    borderRadius: radius.full,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    ...typography.title,
    color: colors.text,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  primaryButton: {
    minHeight: 50,
    marginTop: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: '#111827',
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
