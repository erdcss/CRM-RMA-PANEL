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
import { useRouter } from 'expo-router';

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
  const [active, setActive] = useState<AccountSection>('company');
  const [account, setAccount] = useState<B2BAccount | null>(null);
  const [addresses, setAddresses] = useState<B2BAddress[]>([]);
  const [payments, setPayments] = useState<B2BPaymentMethod[]>([]);
  const [returns, setReturns] = useState<B2BReturn[]>([]);
  const [invoices, setInvoices] = useState<B2BInvoice[]>([]);
  const [support, setSupport] = useState<B2BSupportTicket[]>([]);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [sending, setSending] = useState(false);

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
      <ScrollView contentContainerStyle={styles.page}>
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionTabs}
        >
          {SECTIONS.map((item) => {
            const selected = active === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setActive(item.key)}
                style={[styles.sectionTab, selected && styles.sectionTabActive]}
              >
                <Ionicons
                  name={item.icon}
                  size={17}
                  color={selected ? '#FFFFFF' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.sectionTabText,
                    selected && styles.sectionTabTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

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
          <Panel title="Fatura İşlemleri" subtitle="B2B faturalarınız">
            {invoices.length ? (
              invoices.map((invoice, index) => (
                <Pressable
                  key={invoice.id}
                  onPress={() =>
                    invoice.download_url
                      ? void Linking.openURL(
                          invoice.download_url.startsWith('http')
                            ? invoice.download_url
                            : `${API_BASE_URL}${invoice.download_url}`,
                        )
                      : undefined
                  }
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
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
            <TextInput
              value={supportMessage}
              onChangeText={setSupportMessage}
              placeholder="Mesajınızı yazın"
              placeholderTextColor={colors.textMuted}
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
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.text} />
              <Text style={styles.settingsLabel}>Gizlilik Politikası ve KVKK</Text>
              <Ionicons name="open-outline" size={18} color={colors.textMuted} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable
              style={styles.settingsRow}
              onPress={() => void signOut()}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.danger} />
              <Text style={[styles.settingsLabel, { color: colors.danger }]}>
                Çıkış Yap
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
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
  return (
    <View style={[styles.listRow, last && { borderBottomWidth: 0 }]}>
      <View style={styles.listIcon}>
        <Ionicons name={icon} size={19} color={colors.text} />
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
  return <Text style={styles.emptyText}>{text}</Text>;
}

const styles = StyleSheet.create({
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
    color: colors.text,
    marginTop: spacing.lg,
    fontWeight: '900',
  },
  guestText: {
    ...typography.body,
    color: colors.textSecondary,
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
    color: colors.text,
    fontWeight: '900',
  },
  companyName: {
    ...typography.bodyMedium,
    color: colors.text,
    marginTop: 2,
  },
  email: {
    ...typography.caption,
    color: colors.textMuted,
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
    color: colors.textSecondary,
    fontWeight: '700',
  },
  sectionTabTextActive: {
    color: '#FFFFFF',
  },
  panel: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  panelHeader: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  panelTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontWeight: '800',
  },
  panelSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  panelBody: {
    padding: spacing.lg,
  },
  infoRow: {
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    justifyContent: 'center',
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  infoValue: {
    ...typography.bodyMedium,
    color: colors.text,
    marginTop: 2,
    fontWeight: '700',
  },
  listRow: {
    minHeight: 68,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  listIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listText: {
    flex: 1,
  },
  listTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '800',
  },
  listSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    ...typography.caption,
    color: colors.text,
    backgroundColor: colors.surfaceSecondary,
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
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.text,
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
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
});
