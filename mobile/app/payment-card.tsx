import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ExpoLinking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { appAlert } from '@/lib/appAlert';

function isTrustedInitialUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && host.endsWith('.iyzipay.com');
  } catch {
    return false;
  }
}

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

export default function PaymentCardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string; order?: string }>();
  const initialUrl = String(params.url || '');
  const orderNumber = String(params.order || '');

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const WebView = useMemo(() => loadWebView(), []);

  const safeUrl = useMemo(() => {
    if (!isTrustedInitialUrl(initialUrl)) return '';
    try {
      const url = new URL(initialUrl);
      url.searchParams.set('iframe', 'true');
      return url.toString();
    } catch {
      return '';
    }
  }, [initialUrl]);

  const completeFromDeepLink = (url: string) => {
    const parsed = ExpoLinking.parse(url);
    const query = parsed.queryParams || {};
    const result = typeof query.result === 'string' ? query.result : 'failed';
    const order =
      typeof query.order === 'string' && query.order
        ? query.order
        : orderNumber;
    const stock = typeof query.stock === 'string' ? query.stock : undefined;

    router.replace({
      pathname: '/payment-result',
      params: {
        result,
        order,
        ...(stock ? { stock } : {}),
      },
    } as never);
  };

  if (!safeUrl) {
    return (
      <Screen>
        <View style={styles.center}>
          <View style={styles.errorIcon}>
            <Ionicons name="close" size={34} color="#FFFFFF" />
          </View>
          <Text style={styles.errorTitle}>Güvenli ödeme sayfası doğrulanamadı</Text>
          <Text style={styles.errorText}>
            Ödeme oturumu geçersiz veya süresi dolmuş olabilir.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Ödeme Sayfasına Dön</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (!WebView) {
    return (
      <Screen>
        <View style={styles.center}>
          <View style={styles.errorIcon}>
            <Ionicons name="build-outline" size={34} color="#FFFFFF" />
          </View>
          <Text style={styles.errorTitle}>Kart ödeme modülü bu development build içinde yok</Text>
          <Text style={styles.errorText}>
            Uygulamanın diğer bölümlerini kullanabilirsiniz. Kart ödemesini uygulama içinde açmak için güncel iOS development build kurulmalıdır.
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
            <Text style={styles.title}>Güvenli Kart Ödemesi</Text>
            <Text style={styles.subtitle}>iyzico güvenli ödeme altyapısı</Text>
          </View>

          <View style={styles.secureBadge}>
            <Ionicons name="shield-checkmark" size={16} color={colors.success} />
          </View>
        </View>

        <View style={styles.securityBar}>
          <Ionicons name="lock-closed-outline" size={17} color={colors.textSecondary} />
          <Text style={styles.securityText}>
            Kart bilgilerinizi bu ekranda girin. Kart verileri Çalışkan B2B uygulamasında saklanmaz.
          </Text>
        </View>

        <View style={styles.webviewWrap}>
          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={colors.text} />
              <Text style={styles.loaderText}>Güvenli kart formu hazırlanıyor…</Text>
            </View>
          ) : null}

          {failed ? (
            <View style={styles.loader}>
              <Ionicons name="alert-circle-outline" size={34} color={colors.danger} />
              <Text style={styles.errorTitle}>Ödeme formu yüklenemedi</Text>
              <Pressable
                style={styles.retryButton}
                onPress={() => {
                  setFailed(false);
                  setLoading(true);
                }}
              >
                <Text style={styles.retryText}>Tekrar Dene</Text>
              </Pressable>
            </View>
          ) : null}

          {!failed ? (
            <WebView
              key={failed ? 'failed' : 'ready'}
              source={{ uri: safeUrl }}
              style={styles.webview}
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              setSupportMultipleWindows={false}
              mixedContentMode="never"
              originWhitelist={['https://*', 'caliskanb2b://*', 'caliskanb2b-dev://*']}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setFailed(true);
              }}
              onHttpError={(event) => {
                if (event.nativeEvent.statusCode >= 400) {
                  setLoading(false);
                  setFailed(true);
                }
              }}
              onShouldStartLoadWithRequest={(request) => {
                const target = request.url;

                if (
                  target.startsWith('caliskanb2b://payment-result') ||
                  target.startsWith('caliskanb2b-dev://payment-result')
                ) {
                  completeFromDeepLink(target);
                  return false;
                }

                if (target.startsWith('https://')) {
                  return true;
                }

                appAlert(
                  'Bağlantı engellendi',
                  'Ödeme sırasında güvenli olmayan bir yönlendirme engellendi.',
                  undefined,
                  'warning',
                );
                return false;
              }}
            />
          ) : null}
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
  retryButton: {
    minHeight: 46,
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '800',
  },
});
