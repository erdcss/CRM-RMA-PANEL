import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Alert,
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
import { SupportChat } from '@/components/support/SupportChat';
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
  type B2BSupportConversation,
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
  const { section, ticketId } = useLocalSearchParams<{ section: string; ticketId?: string }>();
  const active: AccountSection = SECTIONS.some(x => x.key === section) ? section as AccountSection : 'company';
  const { palette } = useAppearance();
  const styles = useMemo(() => buildStyles(palette), [palette]);
  const [account, setAccount] = useState<B2BAccount | null>(null);
  const [addresses, setAddresses] = useState<B2BAddress[]>([]);
  const [payments, setPayments] = useState<B2BPaymentMethod[]>([]);
  const [returns, setReturns] = useState<B2BReturn[]>([]);
  const [invoices, setInvoices] = useState<B2BInvoice[]>([]);
  const [support, setSupport] = useState<B2BSupportTicket[]>([]);
  const [selectedSupportId, setSelectedSupportId] = useState<number | null>(null);
  const [supportLoading,setSupportLoading] = useState(true);
  const [supportError,setSupportError] = useState('');
  const autoOpenedSupport = useRef(false);
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

  useEffect(() => {
    // A push tap always wins over automatic opening, including cold launch.
    if (active !== 'support' || !ticketId || !/^[1-9]\d{0,15}$/.test(ticketId)) return;
    autoOpenedSupport.current=true;
    setSelectedSupportId(Number(ticketId));
  }, [active, ticketId]);

  useEffect(() => {
    if (active !== 'support' || !session?.user?.id) return;
    let cancelled=false;
    setSupportLoading(true);
    const refresh=async()=>{
      try{
        const rows=await rmaApi.listB2BSupport();
        if(cancelled)return;
        setSupport(rows);
        setSupportError('');
        setSelectedSupportId(current=>{
          if(current!==null && !rows.some(row=>row.id===current)){
            // Closed conversations leave the customer's active support inbox.
            return null;
          }
          if(current===null && rows.length>0 && !autoOpenedSupport.current && !ticketId){
            autoOpenedSupport.current=true;
            return rows[0].id;
          }
          return current;
        });
      }catch(e){
        if(!cancelled)setSupportError(e instanceof Error?e.message:'Destek talepleri alınamadı.');
      }finally{
        if(!cancelled)setSupportLoading(false);
      }
    };
    void refresh();
    const timer=setInterval(()=>void refresh(),12000);
    return()=>{cancelled=true;clearInterval(timer);};
  },[active,session?.user?.id,ticketId]);

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
    if(supportLoading||support.length>0||!supportSubject.trim()||!supportMessage.trim()||sending)return;
    setSending(true);
    setSupportError('');
    try{
      const ticket=await rmaApi.createB2BSupport(supportSubject.trim(),supportMessage.trim());
      autoOpenedSupport.current=true;
      setSupportSubject('');
      setSupportMessage('');
      setSupport([ticket]);
      setSelectedSupportId(ticket.id);
    }catch(e){
      const msg=e instanceof Error?e.message:'Talep oluşturulamadı.';
      setSupportError(msg);
      const active=await rmaApi.listB2BSupport().catch(()=>[]);
      setSupport(active);
      if(active.length){
        autoOpenedSupport.current=true;
        setSelectedSupportId(active[0].id);
      }else Alert.alert('Destek talebi oluşturulamadı',msg);
    }finally{
      setSending(false);
    }
  };

  if(active==='support'&&selectedSupportId!==null){
    return <SupportChat ticketId={selectedSupportId}
      onBack={()=>{setSelectedSupportId(null);}}
      onClosed={()=>{
        setSelectedSupportId(null);
        setSupport([]);
        void rmaApi.listB2BSupport().then(setSupport).catch(()=>undefined);
      }}/>;
  }

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
                <View key={payment.id}>
                <ListCard
                  key={payment.id}
                  icon="card-outline"
                  title={payment.brand || payment.provider || 'Kart'}
                  subtitle={
                    payment.last4 ? `•••• ${payment.last4}` : 'Kart bilgisi'
                  }
                  badge={payment.is_default ? 'Varsayılan' : undefined}
                  last={false}
                />
                <Pressable accessibilityRole="button"
                  style={{ alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 8 }}
                  onPress={() => Alert.alert(
                    'Kayıtlı kartı sil',
                    `•••• ${payment.last4 || '••••'} ile biten kart iyzico üzerinden kaldırılacak. Devam edilsin mi?`,
                    [
                      { text: 'Vazgeç', style: 'cancel' },
                      { text: 'Kartı Sil', style: 'destructive', onPress: () => {
                        void rmaApi.removeB2BPaymentMethod(payment.id)
                          .then(() => setPayments(items => items.filter(item => item.id !== payment.id)))
                          .catch(error => appAlert('Kart silinemedi', error instanceof Error ? error.message : 'Lütfen tekrar deneyin.', undefined, 'error'));
                      } },
                    ],
                  )}>
                  <Text style={{ fontSize: 13, color: '#DC2626', fontWeight: '600' }}>Kayıtlı Kartı Sil</Text>
                </Pressable>
                </View>
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
          <Panel title="Destek Merkezi" subtitle="Çalışkan B2B müşteri destek ekibiyle güvenli mesajlaşma">
            {supportLoading ? (
              <View style={{alignItems:'center',paddingVertical:36}}>
                <Text style={{color:palette.muted}}>Görüşmeleriniz yükleniyor…</Text>
              </View>
            ) : support.length>0 ? (
              <View style={{gap:15}}>
                <View style={{borderRadius:16,padding:14,backgroundColor:palette.surfaceSecondary}}>
                  <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                    <Ionicons name="chatbubbles-outline" size={27} color={palette.accent}/>
                    <View style={{flex:1}}>
                      <Text style={{fontSize:16,fontWeight:'800',color:palette.text}}>Aktif Destek Görüşmeniz</Text>
                      <Text style={{fontSize:12,color:palette.textSecondary,marginTop:4}}>
                        Yeni bir talep oluşturmak için mevcut sohbeti sonlandırmalısınız.
                      </Text>
                    </View>
                  </View>
                </View>
                {support.map(ticket=>(
                  <Pressable key={ticket.id} accessibilityRole="button"
                    accessibilityLabel="Aktif destek sohbetine git"
                    onPress={()=>{
                      autoOpenedSupport.current=true;
                      setSelectedSupportId(ticket.id);
                    }}
                    style={{borderColor:palette.border,borderWidth:1,padding:17,borderRadius:17}}>
                    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
                      <Text style={{color:palette.text,fontSize:16,fontWeight:'700',flex:1}}>{ticket.subject}</Text>
                      <Text style={{color:palette.accent,fontSize:11,fontWeight:'800'}}>
                        {ticket.status==='answered'?'Yanıtlandı':'Açık'}
                      </Text>
                    </View>
                    <Text style={{color:palette.textSecondary,marginTop:9,fontSize:13}} numberOfLines={2}>
                      {ticket.last_message||ticket.message}
                    </Text>
                    <View style={{flexDirection:'row',alignItems:'center',gap:7,marginTop:14,justifyContent:'flex-end'}}>
                      <Text style={{color:palette.accent,fontWeight:'800',fontSize:13}}>Sohbete Git</Text>
                      <Ionicons name="chevron-forward" size={17} color={palette.accent}/>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={{gap:13}}>
                <Text style={{color:palette.text,fontSize:15,fontWeight:'800'}}>
                  Yeni Destek Görüşmesi
                </Text>
                <Text style={{color:palette.textSecondary,fontSize:12,lineHeight:19}}>
                  Bir konu yazıp mesaj gönderin. Talebiniz açıldığında destek ekibiyle sohbet edebilirsiniz.
                </Text>
                <TextInput value={supportSubject} onChangeText={setSupportSubject}
                  placeholder="Talep konusu" placeholderTextColor={palette.muted}
                  maxLength={180} style={styles.input}/>
                <TextInput value={supportMessage} onChangeText={setSupportMessage}
                  placeholder="Mesajınızı Türkçe yazın…" placeholderTextColor={palette.muted}
                  multiline maxLength={4000}
                  style={[styles.input,styles.messageInput]}/>
                <Pressable style={[
                  styles.primaryButton,
                  (!supportSubject.trim()||!supportMessage.trim()||sending)&&styles.disabled,
                ]} disabled={!supportSubject.trim()||!supportMessage.trim()||sending}
                  onPress={()=>void submitSupport()}>
                  <Text style={styles.primaryButtonText}>
                    {sending?'Gönderiliyor…':'Sohbet Başlat'}
                  </Text>
                </Pressable>
              </View>
            )}
            {supportError?<Text style={{color:colors.danger,fontSize:12,marginTop:12}}>{supportError}</Text>:null}
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
