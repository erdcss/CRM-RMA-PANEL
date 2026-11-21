import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { children: ReactNode };
type State = { hasError: boolean };

/** Catch unexpected React render errors without leaving a permanently blank screen. */
export default class BusinessErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Included in JavaScript/runtime diagnostics; native crashes still require
    // App Store Connect crash reports or a dedicated crash-reporting SDK.
    console.error('[Business UI] Unexpected render error:', error, info.componentStack);
  }

  private retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Bir sorun oluştu</Text>
        <Text style={styles.body}>
          Uygulama ekranı yüklenemedi. Kaydedilmiş bilgileriniz silinmedi.
          Tekrar deneyebilir veya uygulamayı kapatıp yeniden açabilirsiniz.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Uygulamayı yeniden dene"
          onPress={this.retry}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Yeniden Dene</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F5F7FB',
  },
  heading: {
    color: '#111827',
    fontSize: 23,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    color: '#4B5563',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    maxWidth: 340,
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2563EB',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
