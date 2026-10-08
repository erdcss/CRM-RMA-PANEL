import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { appAlert } from '@/lib/appAlert';
import {
  absoluteMediaUrl,
  rmaApi,
  type B2BAddress,
  type B2BBankTransferOrder,
  type B2BCheckoutPreview,
  type B2BPaymentSettings,
} from '@/lib/api';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';

type PaymentMethod = 'card' | 'bank_transfer';
type ShippingMethod = 'cargo' | 'freight' | 'pickup';

const EMPTY_ADDRESS = {
  title: 'Teslimat Adresi',
  recipient: '',
  phone: '',
  city: '',
  district: '',
  addressLine: '',
  postalCode: '',
};

function money(value: number) {
  return `${Number(value || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₺`;
}

function scheme() {
  const configured = Constants.expoConfig?.scheme;
  if (Array.isArray(configured)) return configured[0] || 'caliskanb2b';
  return configured || 'caliskanb2b';
}

export default function CheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ productId?: string; qty?: string }>();
  const { session } = useAuth();

  const productId = String(params.productId || '');
  const quantity = Math.max(1, Number.parseInt(String(params.qty || '1'), 10) || 1);

  const [preview, setPreview] = useState<B2BCheckoutPreview | null>(null);
  const [settings, setSettings] = useState<B2BPaymentSettings | null>(null);
  const [addresses, setAddresses] = useState<B2BAddress[]>([]);
  const [account, setAccount] = useState<any>(null);
  const [addressId, setAddressId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('cargo');
  const [freightCompany, setFreightCompany] = useState('');
  const [freightPhone, setFreightPhone] = useState('');
  const [pickupTime, setPickupTime] = useState<'09:00' | '15:00' | '17:00'>('15:00');
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [addressForm, setAddressForm] = useState(EMPTY_ADDRESS);
  const [bankOrder, setBankOrder] = useState<B2BBankTransferOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!session || !productId) return;
    setLoading(true);
    try {
      const [previewData, settingsData, addressData, accountData] = await Promise.all([
        rmaApi.getB2BCheckoutPreview(productId, quantity),
        rmaApi.getB2BPaymentSettings(),
        rmaApi.listB2BAddresses(),
        rmaApi.getB2BAccount(),
      ]);
      setPreview(previewData);
      setSettings(settingsData);
      setAddresses(addressData);
      setAccount(accountData);

      const preferred =
        addressData.find((item) => item.is_default) || addressData[0] || null;
      if (preferred) setAddressId(String(preferred.id));

      if (!settingsData.iyzicoConfigured && settingsData.bankTransfer.enabled) {
        setPaymentMethod('bank_transfer');
      }
    } catch (error) {
      appAlert(
        'Ödeme sayfası açılamadı',
        error instanceof Error ? error.message : 'Sipariş bilgileri alınamadı.',
        undefined,
        'error',
      );
    } finally {
      setLoading(false);
    }
  }, [productId, quantity, session]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedAddress = useMemo(
    () => addresses.find((item) => String(item.id) === addressId) || null,
    [addresses, addressId],
  );

  const shippingPayload = useMemo(() => {
    if (shippingMethod === 'freight') {
      return {
        method: 'freight',
        companyName: freightCompany.trim(),
        phone: freightPhone.trim(),
      };
    }
    if (shippingMethod === 'pickup') {
      return { method: 'pickup', pickupTime };
    }
    return { method: 'cargo' };
  }, [freightCompany, freightPhone, pickupTime, shippingMethod]);

  const shippingValid =
    shippingMethod === 'cargo' ||
    shippingMethod === 'pickup' ||
    (freightCompany.trim().length >= 2 &&
      freightPhone.replace(/\D/g, '').length >= 7);

  const canPay = Boolean(
    preview &&
      selectedAddress &&
      shippingValid &&
      ((paymentMethod === 'card' && settings?.iyzicoConfigured) ||
        (paymentMethod === 'bank_transfer' && settings?.bankTransfer.enabled)),
  );

  const createAddress = async () => {
    if (!addressForm.title.trim() || !addressForm.addressLine.trim()) {
      appAlert('Adres eksik', 'Adres başlığı ve açık adres zorunludur.', undefined, 'warning');
      return;
    }
    setBusy(true);
    try {
      const saved = await rmaApi.createB2BAddress(addressForm);
      setAddresses((current) => [saved, ...current]);
      setAddressId(String(saved.id));
      setAddressForm(EMPTY_ADDRESS);
      setAddressFormOpen(false);
      appAlert('Adres kaydedildi', 'Teslimat adresiniz seçildi.', undefined, 'success');
    } catch (error) {
      appAlert(
        'Adres kaydedilemedi',
        error instanceof Error ? error.message : 'Lütfen tekrar deneyin.',
        undefined,
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const startCardPayment = async () => {
    if (!preview || !selectedAddress || !canPay || busy) return;
    setBusy(true);
    try {
      const mobileReturnUrl = `${scheme()}://payment-result`;
      const result = await rmaApi.initializeB2BIyzicoCheckout({
        productId,
        quantity,
        addressId: selectedAddress.id,
        shipping: shippingPayload,
        mobileReturnUrl,
        checkoutContext: {
          source: 'Çalışkan B2B Mobil',
          entryPath: `/checkout?productId=${productId}&qty=${quantity}`,
          previousPath: `/product/${productId}`,
          cartMode: false,
          productId,
          platform: 'mobile',
        },
      });

      if (!/^https:\/\//i.test(result.paymentPageUrl)) {
        throw new Error('Güvenli ödeme bağlantısı doğrulanamadı.');
      }

      router.push({
        pathname: '/payment-card',
        params: {
          url: result.paymentPageUrl,
          order: result.orderNumber,
        },
      } as never);
    } catch (error) {
      appAlert(
        'Kart ödemesi başlatılamadı',
        error instanceof Error ? error.message : 'Lütfen tekrar deneyin.',
        undefined,
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const createBankTransfer = async () => {
    if (!preview || !selectedAddress || !canPay || busy) return;
    setBusy(true);
    try {
      const order = await rmaApi.createB2BBankTransferOrder({
        productId,
        quantity,
        addressId: selectedAddress.id,
        shipping: shippingPayload,
        checkoutContext: {
          source: 'Çalışkan B2B Mobil',
          entryPath: `/checkout?productId=${productId}&qty=${quantity}`,
          previousPath: `/product/${productId}`,
          cartMode: false,
          productId,
          platform: 'mobile',
        },
      });
      setBankOrder(order);
      appAlert(
        'Havale siparişiniz oluşturuldu',
        'Sipariş kodunu havale açıklamasına yazın.',
        undefined,
        'success',
      );
    } catch (error) {
      appAlert(
        'Havale siparişi oluşturulamadı',
        error instanceof Error ? error.message : 'Lütfen tekrar deneyin.',
        undefined,
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmBankTransfer = async () => {
    if (!bankOrder || busy) return;
    setBusy(true);
    try {
      await rmaApi.confirmB2BBankTransfer(bankOrder.orderNumber);
      router.replace({
        pathname: '/payment-result',
        params: { result: 'success', order: bankOrder.orderNumber, method: 'bank_transfer' },
      } as never);
    } catch (error) {
      appAlert(
        'Bildirim gönderilemedi',
        error instanceof Error ? error.message : 'Lütfen tekrar deneyin.',
        undefined,
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!session) {
    return (
      <Screen>
        <View style={styles.center}>
          <View style={styles.centerIcon}>
            <Ionicons name="lock-closed-outline" size={30} color="#FFFFFF" />
          </View>
          <Text style={styles.centerTitle}>Siparişi tamamlamak için giriş yapın</Text>
          <Text style={styles.centerText}>
            Web sitesindeki Çalışkan B2B hesabınız mobil uygulamada da geçerlidir.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.push('/login')}>
            <Text style={styles.primaryButtonText}>Giriş Yap</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (loading || !preview) {
    return (
      <Screen>
        <View style={styles.center}>
          <Ionicons name="bag-check-outline" size={38} color={colors.textMuted} />
          <Text style={styles.centerTitle}>Ödeme hazırlanıyor…</Text>
        </View>
      </Screen>
    );
  }

  const image = absoluteMediaUrl(preview.product.image);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
          <Text style={styles.backText}>Ürüne dön</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>GÜVENLİ ÖDEME</Text>
          <Text style={styles.title}>Siparişi Tamamla</Text>
          <Text style={styles.subtitle}>
            Teslimat ve ödeme bilgilerinizi kontrol ederek siparişinizi tamamlayın.
          </Text>
        </View>

        <Section title="Sipariş Özeti" icon="bag-handle-outline">
          <View style={styles.productRow}>
            <View style={styles.productImageWrap}>
              {image ? (
                <Image source={{ uri: image }} style={styles.productImage} contentFit="contain" />
              ) : (
                <Ionicons name="cube-outline" size={34} color={colors.textMuted} />
              )}
            </View>
            <View style={styles.productText}>
              <Text style={styles.productSku}>{preview.product.sku || 'STOK'}</Text>
              <Text style={styles.productName}>{preview.product.name}</Text>
              <Text style={styles.productMeta}>
                {preview.quantity} koli × {preview.product.unitsPerBox} adet = {preview.totalUnits} adet
              </Text>
            </View>
            <Text style={styles.lineTotal}>{money(preview.total)}</Text>
          </View>

          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Ürün toplamı</Text>
            <Text style={styles.summaryValue}>{money(preview.total)}</Text>
          </View>
          <View style={[styles.summaryLine, styles.summaryTotal]}>
            <Text style={styles.totalLabel}>Ödenecek toplam</Text>
            <Text style={styles.totalValue}>{money(preview.total)}</Text>
          </View>
        </Section>

        <Section title="Fatura Bilgileri" icon="receipt-outline">
          <InfoLine label="Firma" value={account?.companyName || '—'} />
          <InfoLine label="Vergi no" value={account?.taxNumber || '—'} />
          <InfoLine label="Vergi dairesi" value={account?.taxOffice || '—'} last />
        </Section>

        <Section title="Teslimat Adresi" icon="location-outline">
          {addresses.map((address) => {
            const selected = String(address.id) === addressId;
            return (
              <Pressable
                key={address.id}
                style={[styles.selectCard, selected && styles.selectCardActive]}
                onPress={() => setAddressId(String(address.id))}
              >
                <View style={[styles.radio, selected && styles.radioActive]}>
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={styles.selectText}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.selectTitle}>{address.title}</Text>
                    {address.is_default ? <Text style={styles.badge}>Varsayılan</Text> : null}
                  </View>
                  <Text style={styles.selectSubtitle}>
                    {[address.recipient, address.address_line, address.district, address.city]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          <Pressable
            style={styles.outlineButton}
            onPress={() => setAddressFormOpen((current) => !current)}
          >
            <Ionicons name="add" size={18} color={colors.text} />
            <Text style={styles.outlineButtonText}>Yeni Adres Ekle</Text>
          </Pressable>

          {addressFormOpen ? (
            <View style={styles.formBox}>
              <Input label="Adres Başlığı" value={addressForm.title} onChangeText={(value) => setAddressForm({ ...addressForm, title: value })} />
              <Input label="Teslim Alacak Kişi" value={addressForm.recipient} onChangeText={(value) => setAddressForm({ ...addressForm, recipient: value })} />
              <Input label="Telefon" value={addressForm.phone} onChangeText={(value) => setAddressForm({ ...addressForm, phone: value })} keyboardType="phone-pad" />
              <View style={styles.twoColumns}>
                <View style={styles.half}><Input label="Şehir" value={addressForm.city} onChangeText={(value) => setAddressForm({ ...addressForm, city: value })} /></View>
                <View style={styles.half}><Input label="İlçe" value={addressForm.district} onChangeText={(value) => setAddressForm({ ...addressForm, district: value })} /></View>
              </View>
              <Input label="Açık Adres" value={addressForm.addressLine} onChangeText={(value) => setAddressForm({ ...addressForm, addressLine: value })} multiline />
              <Input label="Posta Kodu" value={addressForm.postalCode} onChangeText={(value) => setAddressForm({ ...addressForm, postalCode: value })} keyboardType="number-pad" />
              <Pressable style={styles.primaryButton} onPress={createAddress} disabled={busy}>
                <Text style={styles.primaryButtonText}>{busy ? 'Kaydediliyor…' : 'Adresi Kaydet'}</Text>
              </Pressable>
            </View>
          ) : null}
        </Section>

        <Section title="Teslimat Yöntemi" icon="car-outline">
          <ChoiceCard
            active={shippingMethod === 'cargo'}
            title="PTT Kargo"
            subtitle="Siparişiniz kayıtlı teslimat adresinize gönderilir."
            icon="cube-outline"
            onPress={() => setShippingMethod('cargo')}
          />
          <ChoiceCard
            active={shippingMethod === 'freight'}
            title="Ambar"
            subtitle="Belirttiğiniz ambar firmasına teslim edilir."
            icon="trail-sign-outline"
            onPress={() => setShippingMethod('freight')}
          />
          {shippingMethod === 'freight' ? (
            <View style={styles.formBox}>
              <Input label="Ambar Firma Adı" value={freightCompany} onChangeText={setFreightCompany} />
              <Input label="Ambar Telefonu" value={freightPhone} onChangeText={setFreightPhone} keyboardType="phone-pad" />
            </View>
          ) : null}
          <ChoiceCard
            active={shippingMethod === 'pickup'}
            title="Depodan Teslim"
            subtitle="Siparişinizi Çalışkan deposundan teslim alın."
            icon="storefront-outline"
            onPress={() => setShippingMethod('pickup')}
          />
          {shippingMethod === 'pickup' ? (
            <View style={styles.pickupTimes}>
              {(['09:00', '15:00', '17:00'] as const).map((time) => (
                <Pressable
                  key={time}
                  style={[styles.timeChip, pickupTime === time && styles.timeChipActive]}
                  onPress={() => setPickupTime(time)}
                >
                  <Text style={[styles.timeText, pickupTime === time && styles.timeTextActive]}>{time}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </Section>

        <Section title="Ödeme Yöntemi" icon="wallet-outline">
          {settings?.iyzicoConfigured ? (
            <ChoiceCard
              active={paymentMethod === 'card'}
              title="Banka / Kredi Kartı"
              subtitle="iyzico güvenli ödeme altyapısı"
              icon="card-outline"
              onPress={() => {
                setPaymentMethod('card');
                setBankOrder(null);
              }}
            />
          ) : null}

          {settings?.bankTransfer.enabled ? (
            <ChoiceCard
              active={paymentMethod === 'bank_transfer'}
              title="Havale / EFT"
              subtitle="Sipariş kodunuzla banka transferi yapın."
              icon="business-outline"
              onPress={() => setPaymentMethod('bank_transfer')}
            />
          ) : null}

          {paymentMethod === 'card' ? (
            <View style={styles.secureBox}>
              <View style={styles.secureIcon}>
                <Ionicons name="shield-checkmark" size={24} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.secureTitle}>iyzico Güvenli Kart Ödemesi</Text>
                <Text style={styles.secureText}>
                  Kart bilgilerinizi uygulama içindeki güvenli iyzico formunda girersiniz. Kart verileri Çalışkan B2B tarafından saklanmaz; ödeme tamamlandığında sonuç ekranı uygulama içinde açılır.
                </Text>
              </View>
            </View>
          ) : null}

          {paymentMethod === 'bank_transfer' && !bankOrder ? (
            <View style={styles.bankPreview}>
              <InfoLine label="Banka" value={settings?.bankTransfer.bankName || '—'} />
              <InfoLine label="Hesap sahibi" value={settings?.bankTransfer.accountHolder || '—'} />
              <InfoLine label="IBAN" value={settings?.bankTransfer.iban || '—'} last />
            </View>
          ) : null}

          {bankOrder ? (
            <View style={styles.bankOrder}>
              <View style={styles.successMark}>
                <Ionicons name="checkmark" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.bankOrderTitle}>Havale sipariş kodunuz hazır</Text>
              <Text style={styles.orderCode}>{bankOrder.orderNumber}</Text>
              <CopyRow label="IBAN" value={bankOrder.bankTransfer.iban} />
              <CopyRow label="Açıklama" value={bankOrder.transferDescription} />
              <Text style={styles.bankHint}>
                Havale açıklamasına sipariş kodunu eksiksiz yazın.
              </Text>
              <Pressable style={styles.primaryButton} onPress={confirmBankTransfer} disabled={busy}>
                <Text style={styles.primaryButtonText}>
                  {busy ? 'Gönderiliyor…' : 'Ödemeyi Yaptım'}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </Section>

        {!selectedAddress ? (
          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={20} color={colors.warning} />
            <Text style={styles.warningText}>Siparişi tamamlamak için teslimat adresi ekleyin.</Text>
          </View>
        ) : null}

        {!shippingValid ? (
          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={20} color={colors.warning} />
            <Text style={styles.warningText}>Ambar firma adı ve telefonunu tamamlayın.</Text>
          </View>
        ) : null}

        {!bankOrder ? (
          <Pressable
            style={[styles.payButton, !canPay && styles.disabled]}
            disabled={!canPay || busy}
            onPress={paymentMethod === 'card' ? startCardPayment : createBankTransfer}
          >
            <Ionicons
              name={paymentMethod === 'card' ? 'lock-closed' : 'business'}
              size={19}
              color="#FFFFFF"
            />
            <Text style={styles.payButtonText}>
              {busy
                ? 'Hazırlanıyor…'
                : paymentMethod === 'card'
                  ? `${money(preview.total)} · Güvenli Ödemeye Geç`
                  : `${money(preview.total)} · Havale Siparişi Oluştur`}
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.securityFooter}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.textMuted} />
          <Text style={styles.securityText}>
            Ödeme bilgileri güvenli bağlantı üzerinden işlenir.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={19} color={colors.text} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function InfoLine({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoLine, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.infoLineLabel}>{label}</Text>
      <Text style={styles.infoLineValue}>{value}</Text>
    </View>
  );
}

function ChoiceCard({
  active,
  title,
  subtitle,
  icon,
  onPress,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.choiceCard, active && styles.choiceCardActive]} onPress={onPress}>
      <View style={[styles.choiceIcon, active && styles.choiceIconActive]}>
        <Ionicons name={icon} size={20} color={active ? '#FFFFFF' : colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.choiceSubtitle}>{subtitle}</Text>
      </View>
      <View style={[styles.radio, active && styles.radioActive]}>
        {active ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

function Input({
  label,
  value,
  onChangeText,
  keyboardType,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMultiline]}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <Pressable
      style={styles.copyRow}
      onPress={async () => {
        await Clipboard.setStringAsync(value);
        appAlert('Kopyalandı', `${label} panoya kopyalandı.`, undefined, 'success');
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.copyLabel}>{label}</Text>
        <Text style={styles.copyValue}>{value}</Text>
      </View>
      <Ionicons name="copy-outline" size={19} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  back: { minHeight: minTouchTarget, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  backText: { ...typography.bodyMedium, color: colors.textSecondary },
  header: { marginTop: spacing.lg, marginBottom: spacing.xl },
  eyebrow: { ...typography.caption, color: colors.textMuted, fontWeight: '800', letterSpacing: 1.2 },
  title: { ...typography.largeTitle, color: colors.text, fontWeight: '900', marginTop: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  section: { borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: spacing.md },
  sectionHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  sectionIcon: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { ...typography.subtitle, color: colors.text, fontWeight: '900' },
  sectionBody: { padding: spacing.lg, gap: spacing.sm },
  productRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  productImageWrap: { width: 76, height: 76, borderRadius: radius.md, backgroundColor: '#FAFAFA', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  productImage: { width: '100%', height: '100%' },
  productText: { flex: 1 },
  productSku: { ...typography.caption, color: colors.textMuted },
  productName: { ...typography.bodyMedium, color: colors.text, fontWeight: '800', marginTop: 2 },
  productMeta: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  lineTotal: { ...typography.bodyMedium, color: colors.text, fontWeight: '900' },
  summaryLine: { minHeight: 44, borderTopWidth: 1, borderTopColor: colors.borderLight, marginTop: spacing.sm, paddingTop: spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { ...typography.body, color: colors.textSecondary },
  summaryValue: { ...typography.bodyMedium, color: colors.text, fontWeight: '800' },
  summaryTotal: { minHeight: 52 },
  totalLabel: { ...typography.subtitle, color: colors.text, fontWeight: '900' },
  totalValue: { ...typography.title, color: colors.text, fontWeight: '900' },
  infoLine: { minHeight: 50, borderBottomWidth: 1, borderBottomColor: colors.borderLight, justifyContent: 'center' },
  infoLineLabel: { ...typography.caption, color: colors.textMuted },
  infoLineValue: { ...typography.bodyMedium, color: colors.text, fontWeight: '700', marginTop: 2 },
  selectCard: { minHeight: 76, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  selectCardActive: { borderColor: colors.text, backgroundColor: '#FAFAFA' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: '#111827' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#111827' },
  selectText: { flex: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  selectTitle: { ...typography.bodyMedium, color: colors.text, fontWeight: '800' },
  selectSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 3 },
  badge: { ...typography.caption, color: colors.text, backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full, overflow: 'hidden' },
  outlineButton: { minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  outlineButtonText: { ...typography.bodyMedium, color: colors.text, fontWeight: '800' },
  formBox: { borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, padding: spacing.md, gap: spacing.md },
  inputGroup: { gap: spacing.xs },
  inputLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, ...typography.body, color: colors.text },
  inputMultiline: { minHeight: 92, paddingTop: spacing.md, textAlignVertical: 'top' },
  twoColumns: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  choiceCard: { minHeight: 74, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  choiceCardActive: { borderColor: colors.text, backgroundColor: '#FAFAFA' },
  choiceIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  choiceIconActive: { backgroundColor: '#111827' },
  choiceTitle: { ...typography.bodyMedium, color: colors.text, fontWeight: '800' },
  choiceSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  pickupTimes: { flexDirection: 'row', gap: spacing.sm },
  timeChip: { flex: 1, minHeight: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  timeChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  timeText: { ...typography.bodyMedium, color: colors.text },
  timeTextActive: { color: '#FFFFFF' },
  secureBox: { borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, padding: spacing.md, flexDirection: 'row', gap: spacing.md },
  secureIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  secureTitle: { ...typography.bodyMedium, color: colors.text, fontWeight: '800' },
  secureText: { ...typography.caption, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  bankPreview: { borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.md },
  bankOrder: { borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, padding: spacing.lg, alignItems: 'stretch' },
  successMark: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  bankOrderTitle: { ...typography.subtitle, color: colors.text, fontWeight: '900', textAlign: 'center', marginTop: spacing.sm },
  orderCode: { ...typography.title, color: colors.text, fontWeight: '900', textAlign: 'center', marginVertical: spacing.md },
  copyRow: { minHeight: 60, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copyLabel: { ...typography.caption, color: colors.textMuted },
  copyValue: { ...typography.bodyMedium, color: colors.text, fontWeight: '800', marginTop: 2 },
  bankHint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' },
  warningBox: { borderRadius: radius.md, backgroundColor: colors.warningSoft, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  warningText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  payButton: { minHeight: 58, borderRadius: radius.lg, backgroundColor: '#111827', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  payButtonText: { ...typography.bodyMedium, color: '#FFFFFF', fontWeight: '900' },
  primaryButton: { minHeight: 50, borderRadius: radius.md, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  primaryButtonText: { ...typography.bodyMedium, color: '#FFFFFF', fontWeight: '800' },
  disabled: { opacity: 0.45 },
  securityFooter: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  securityText: { ...typography.caption, color: colors.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl },
  centerIcon: { width: 64, height: 64, borderRadius: radius.full, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  centerTitle: { ...typography.title, color: colors.text, fontWeight: '900', textAlign: 'center', marginTop: spacing.lg },
  centerText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
});
