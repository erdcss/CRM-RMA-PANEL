import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppearance, type AppPalette } from '@/contexts/AppearanceContext';
import { openB2BInvoice } from '@/lib/invoice-files';
import { appAlert } from '@/lib/appAlert';

import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing, typography } from '@/constants/theme';
import {
  API_BASE_URL,
  rmaApi,
  type B2BAccount,
  type B2BAddress,
  type B2BInvoice,
  type B2BPaymentMethod,
  type B2BReturn,
  type B2BSupportTicket,
} from '@/lib/api';

type AccountSection =
  | 'company'
  | 'addresses'
  | 'payments'
  | 'returns'
  | 'invoices'
  | 'support'
  | 'settings';

const SECTIONS: Array<{
  key: AccountSection;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'company', label: 'Firma Bilgilerim', icon: 'business-outline' },
  { key: 'addresses', label: 'Kayıtlı Adreslerim', icon: 'location-outline' },
  { key: 'payments', label: 'Ödeme Bilgilerim', icon: 'card-outline' },
  { key: 'returns', label: 'İade İşlemleri', icon: 'return-down-back-outline' },
  { key: 'invoices', label: 'Fatura İşlemleri', icon: 'document-text-outline' },
  { key: 'support', label: 'Destek Hattı', icon: 'headset-outline' },
  { key: 'settings', label: 'Ayarlar', icon: 'settings-outline' },
];

function emptyInitials(value?: string | null) {
  const clean = String(value || '').trim();
  if (!clean) return 'B2B';
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function ProfileScreen() {
  const router = useRouter();
  const { session, user, signOut } = useAuth();
  const { section } = useLocalSearchParams<{ section: string }>();
  const active: AccountSection = SECTIONS.some(x => x.key === section) ? section as AccountSection : 'company';
  const { palette } = useAppearance();
  const styles = useMemo(() => buildStyles(palette), [palette]);
  const [account, setAccount] = useState<B2BAccount | null>(null);
  const [addresses, setAddresses] = useState<B2BAddress[]>([]);
  const [payments, setPayments] = useState<B2BPaymentMethod[]>([]);
  const [returns, setReturns] = useState<B2BReturn[]>([]);
  const [invoices, setInvoices] = useState<B2BInvoice[]>([]);
  const [support, setSupport] = useState<B2BSupportTicket[]>([]);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const loadAccount = useCallback(async () => {
    if (!session) return;

    const results = await Promise.allSettled([
      rmaApi.getB2BAccount(),
      rmaApi.listB2BAddresses(),
      rmaApi.listB2BPaymentMethods(),
      rmaApi.listB2BReturns(),
      rmaApi.listB2BInvoices(),
      rmaApi.listB2BSupport(),
    ]);

    if (results[0].status === 'fulfilled') setAccount(results[0].value);
    if (results[1].status === 'fulfilled') setAddresses(results[1].value);
    if (results[2].status === 'fulfilled') setPayments(results[2].value);
    if (results[3].status === 'fulfilled') setReturns(results[3].value);
    if (results[4].status === 'fulfilled') setInvoices(results[4].value);
    if (results[5].status === 'fulfilled') setSupport(results[5].value);
  }, [session]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  const displayName = useMemo(() => {
    const fullName = [account?.firstName, account?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return account?.companyName || fullName || user?.email?.split('@')[0] || 'Çalışkan B2B';
  }, [account, user?.email]);

  if (!session) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.guestPage}>
          <View style={styles.guestIcon}>
            <Ionicons name="person-outline" size={34} color="#FFFFFF" />
          </View>
          <Text style={styles.guestTitle}>Hesabım</Text>
          <Text style={styles.guestText}>
            Firma bilgileri, adresler, ödemeler, iadeler, faturalar ve destek
            işlemleriniz için B2B hesabınıza giriş yapın.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.push('/login')}>
            <Text style={styles.primaryButtonText}>Giriş Yap</Text>
          </Pressable>
        </ScrollView>
      </Screen>
    );
  }

  const submitSupport = async () => {
    if (!supportSubject.trim() || !supportMessage.trim() || sending) return;
    setSending(true);
    try {
      await rmaApi.createB2BSupport(supportSubject.trim(), supportMessage.trim());
      setSupportSubject('');
      setSupportMessage('');
      setSupport(await rmaApi.listB2BSupport());
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.page, { backgroundColor: palette.background }]}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{emptyInitials(displayName)}</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Hesabım</Text>
            <Text style={styles.companyName}>{displayName}</Text>
            <Text style={styles.email}>{account?.email || user?.email || ''}</Text>
          </View>
        </View>

        <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18, minHeight: 44 }}>
          <Ionicons name="chevron-back" size={22} color={palette.text} />
          <Text style={{ color: palette.text, fontSize: 16, fontWeight: '700' }}>Hesabım / {SECTIONS.find(x => x.key === active)?.label}</Text>
        </Pressable>
        {active === 'company' ? (
          <Panel title="Firma Bilgilerim" subtitle="Web hesabınızdaki firma bilgileri">
            <InfoRow label="Firma adı" value={account?.companyName} />
            <InfoRow label="Firma kategorisi" value={account?.companyCategory} />
            <InfoRow
              label="Yetkili"
              value={[account?.firstName, account?.lastName].filter(Boolean).join(' ')}
            />
            <InfoRow label="E-posta" value={account?.email} />
            <InfoRow label="Vergi numarası" value={account?.taxNumber} />
            <InfoRow label="Vergi dairesi" value={account?.taxOffice} last />
          </Panel>
        ) : null}

        {active === 'addresses' ? (
          <Panel title="Kayıtlı Adreslerim" subtitle="Teslimat ve firma adresleriniz">
            {addresses.length ? (
              addresses.map((address, index) => (
                <ListCard
                  key={address.id}
                  icon="location-outline"
                  title={address.title}
                  subtitle={[
                    address.recipient,
                    address.address_line,
                    address.district,
                    address.city,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  badge={address.is_default ? 'Varsayılan' : undefined}
                  last={index === addresses.length - 1}
                />
              ))
            ) : (
              <EmptyText text="Kayıtlı adres bulunmuyor." />
            )}
          </Panel>
        ) : null}

        {active === 'payments' ? (
          <Panel title="Ödeme Bilgilerim" subtitle="Kayıtlı ödeme yöntemleriniz">
            {payments.length ? (
              payments.map((payment, index) => (
                <ListCard
                  key={payment.id}
                  icon="card-outline"
                  title={payment.brand || payment.provider || 'Kart'}
                  subtitle={
                    payment.last4 ? `•••• ${payment.last4}` : 'Kart bilgisi'
                  }
                  badge={payment.is_default ? 'Varsayılan' : undefined}
                  last={index === payments.length - 1}
                />
              ))
            ) : (
              <EmptyText text="Kayıtlı ödeme yöntemi bulunmuyor." />
            )}
          </Panel>
        ) : null}

        {active === 'returns' ? (
          <Panel title="İade İşlemleri" subtitle="İade talepleriniz ve durumları">
            {returns.length ? (
              returns.map((item, index) => (
                <ListCard
                  key={item.id}
                  icon="return-down-back-outline"
                  title={item.order_number || `İade #${item.id}`}
                  subtitle={item.reason || 'İade kaydı'}
                  badge={item.status || undefined}
                  last={index === returns.length - 1}
                />
              ))
            ) : (
              <EmptyText text="İade kaydınız bulunmuyor." />
            )}
          </Panel>
        ) : null}

        {active === 'invoices' ? (
          <Panel title="Faturalarım" subtitle="Faturalarınız güvenli şekilde indirilir ve cihazınızda açılır">
            {invoices.length ? (
              invoices.map((invoice, index) => (
                <Pressable
                  key={invoice.id}
                  onPress={() => void openB2BInvoice(invoice.id).catch(error =>
                    appAlert('Fatura görüntülenemedi',
                      error instanceof Error ? error.message : 'Dosya açılamadı', undefined, 'error')
                  )}
                >
                  <ListCard
                    icon="document-text-outline"
                    title={invoice.invoice_number || `Fatura #${invoice.id}`}
                    subtitle={invoice.order_number || 'Sipariş faturası'}
                    badge={
                      invoice.total_amount != null
                        ? `${Number(invoice.total_amount).toLocaleString('tr-TR')} ₺`
                        : undefined
                    }
                    last={index === invoices.length - 1}
                  />
                </Pressable>
              ))
            ) : (
              <EmptyText text="Fatura kaydınız bulunmuyor." />
            )}
          </Panel>
        ) : null}

        {active === 'support' ? (
          <Panel title="Destek Hattı" subtitle="Çalışkan B2B destek ekibine ulaşın">
            <TextInput
              value={supportSubject}
              onChangeText={setSupportSubject}
              placeholder="Konu"
              placeholderTextColor={palette.muted}
              style={styles.input}
            />
            <TextInput
              value={supportMessage}
              onChangeText={setSupportMessage}
              placeholder="Mesajınızı yazın"
              placeholderTextColor={palette.muted}
              multiline
              style={[styles.input, styles.messageInput]}
            />
            <Pressable
              style={[
                styles.primaryButton,
                (!supportSubject.trim() || !supportMessage.trim() || sending) &&
                  styles.disabled,
              ]}
              onPress={submitSupport}
              disabled={!supportSubject.trim() || !supportMessage.trim() || sending}
            >
              <Text style={styles.primaryButtonText}>
                {sending ? 'Gönderiliyor…' : 'Destek Talebi Gönder'}
              </Text>
            </Pressable>

            <View style={styles.supportHistory}>
              {support.map((ticket, index) => (
                <ListCard
                  key={ticket.id}
                  icon="chatbubble-ellipses-outline"
                  title={ticket.subject}
                  subtitle={ticket.message}
                  badge={ticket.status || undefined}
                  last={index === support.length - 1}
                />
              ))}
            </View>
          </Panel>
        ) : null}

        {active === 'settings' ? (
          <Panel title="Ayarlar" subtitle="Hesap ve uygulama tercihleri">
            <Pressable
              style={styles.settingsRow}
              onPress={() => void Linking.openURL(`${API_BASE_URL}/privacy`)}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color={palette.text} />
              <Text style={styles.settingsLabel}>Gizlilik Politikası ve KVKK</Text>
              <Ionicons name="open-outline" size={18} color={palette.muted} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hesabımı silme seçeneklerini aç"
              style={styles.settingsRow}
              onPress={() => setDeleteAccountOpen((open) => !open)}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
              <Text style={[styles.settingsLabel, { color: colors.danger }]}>Hesabımı Sil</Text>
              <Ionicons name={deleteAccountOpen ? "chevron-up" : "chevron-forward"} size={18} color={palette.muted} />
            </Pressable>
            {deleteAccountOpen ? (
              <View style={{ paddingVertical: spacing.md }}>
                <Text style={{ color: palette.textSecondary, lineHeight: 21, marginBottom: spacing.md }}>
                  Bu işlem hesabınıza erişimi kalıcı olarak kapatır. Sipariş ve fatura gibi yasal saklama zorunluluğu bulunan kayıtlar ilgili süre boyunca korunabilir.
                </Text>
                <TextInput
                  style={styles.input}
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  placeholder="Onaylamak için mevcut şifreniz"
                  placeholderTextColor={palette.muted}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  accessibilityLabel="Hesap silme şifresi"
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={!deletePassword.trim() || deletingAccount}
                  style={[styles.primaryButton, { backgroundColor: colors.danger }, (!deletePassword.trim() || deletingAccount) && styles.disabled]}
                  onPress={() => {
                    appAlert(
                      'Hesabınızı silmek istiyor musunuz?',
                      'Hesap erişiminiz kalıcı olarak kapanır. Bu işlem geri alınamaz. Yasal olarak saklanması zorunlu kayıtlar korunabilir.',
                      [
                        { text: 'Vazgeç', style: 'cancel' },
                        { text: 'Hesabımı Sil', style: 'destructive', onPress: () => {
                          if (deletingAccount || !deletePassword.trim()) return;
                          void (async () => {
                            setDeletingAccount(true);
                            try {
                              await rmaApi.deleteB2BAccount(deletePassword);
                              setDeletePassword('');
                              await signOut();
                              router.replace('/login');
                            } catch (error) {
                              appAlert('Hesap silinemedi', error instanceof Error ? error.message : 'Lütfen tekrar deneyin.', undefined, 'error');
                            } finally {
                              setDeletingAccount(false);
                            }
                          })();
                        } },
                      ],
                      'warning',
                    );
                  }}
                >
                  <Text style={styles.primaryButtonText}>{deletingAccount ? 'İşleniyor...' : 'Kalıcı Silmeyi Onayla'}</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.divider} />
            <Pressable
              style={styles.settingsRow}
              onPress={() => void signOut()}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.danger} />
              <Text style={[styles.settingsLabel, { color: colors.danger }]}>
                Çıkış Yap
              </Text>
              <Ionicons name="chevron-forward" size={18} color={palette.muted} />
            </Pressable>
          </Panel>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { palette } = useAppearance();
  const styles = useMemo(() => buildStyles(palette), [palette]);
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>{title}</Text>
        <Text style={styles.panelSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.panelBody}>{children}</View>
    </View>
  );
}

function InfoRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value?: string | null;
  last?: boolean;
}) {
  const { palette } = useAppearance();
  const styles = useMemo(() => buildStyles(palette), [palette]);
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

function ListCard({
  icon,
  title,
  subtitle,
  badge,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  badge?: string;
  last?: boolean;
}) {
  const { palette } = useAppearance();
  const styles = useMemo(() => buildStyles(palette), [palette]);
  return (
    <View style={[styles.listRow, last && { borderBottomWidth: 0 }]}>
      <View style={styles.listIcon}>
        <Ionicons name={icon} size={19} color={palette.text} />
      </View>
      <View style={styles.listText}>
        <Text style={styles.listTitle}>{title}</Text>
        <Text style={styles.listSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      {badge ? <Text style={styles.badge}>{badge}</Text> : null}
    </View>
  );
}

function EmptyText({ text }: { text: string }) {
  const { palette } = useAppearance();
  const styles = useMemo(() => buildStyles(palette), [palette]);
  return <Text style={styles.emptyText}>{text}</Text>;
}

const buildStyles = (palette: AppPalette) => StyleSheet.create({
  page: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 120,
  },
  guestPage: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingBottom: 100,
  },
  guestIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestTitle: {
    ...typography.largeTitle,
    color: palette.text,
    marginTop: spacing.lg,
    fontWeight: '900',
  },
  guestText: {
    ...typography.body,
    color: palette.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: radius.full,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.title,
    color: palette.text,
    fontWeight: '900',
  },
  companyName: {
    ...typography.bodyMedium,
    color: palette.text,
    marginTop: 2,
  },
  email: {
    ...typography.caption,
    color: palette.muted,
    marginTop: 1,
  },
  sectionTabs: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  sectionTab: {
    minHeight: 42,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionTabActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  sectionTabText: {
    ...typography.caption,
    color: palette.textSecondary,
    fontWeight: '700',
  },
  sectionTabTextActive: {
    color: '#FFFFFF',
  },
  panel: {
    borderRadius: radius.xl,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  panelHeader: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  panelTitle: {
    ...typography.subtitle,
    color: palette.text,
    fontWeight: '800',
  },
  panelSubtitle: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 2,
  },
  panelBody: {
    padding: spacing.lg,
  },
  infoRow: {
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    justifyContent: 'center',
  },
  infoLabel: {
    ...typography.caption,
    color: palette.muted,
  },
  infoValue: {
    ...typography.bodyMedium,
    color: palette.text,
    marginTop: 2,
    fontWeight: '700',
  },
  listRow: {
    minHeight: 68,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  listIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listText: {
    flex: 1,
  },
  listTitle: {
    ...typography.bodyMedium,
    color: palette.text,
    fontWeight: '800',
  },
  listSubtitle: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 2,
  },
  badge: {
    ...typography.caption,
    color: palette.text,
    backgroundColor: palette.surfaceSecondary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
    fontWeight: '700',
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.background,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: palette.text,
    marginBottom: spacing.sm,
  },
  messageInput: {
    minHeight: 110,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  primaryButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.5,
  },
  supportHistory: {
    marginTop: spacing.lg,
  },
  settingsRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  settingsLabel: {
    flex: 1,
    ...typography.bodyMedium,
    color: palette.text,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
  },
  emptyText: {
    ...typography.body,
    color: palette.muted,
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
});
