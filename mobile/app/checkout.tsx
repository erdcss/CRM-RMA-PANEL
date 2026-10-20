import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { useAppearance, type AppPalette } from '@/contexts/AppearanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { appAlert } from '@/lib/appAlert';
import {
  absoluteMediaUrl,
  homepageMediaUrl,
  rmaApi,
  type B2BAddress,
  type B2BBankTransferOrder,
  type B2BBankTransferReference,
  type B2BCheckoutPreview,
  type B2BCheckoutCartPreview,
  type B2BPaymentSettings,
  type B2BInstallmentLookup,
} from '@/lib/api';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { clearOrderList, getOrderList } from '@/lib/b2b-order-list';

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

function formatCardNumber(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.match(/.{1,4}/g)?.join(' ') || '';
}

function validCardNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 16) return false;

  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

export default function CheckoutScreen() {
  const { palette } = useAppearance();
  const styles = useMemo(() => buildStyles(palette), [palette]);
  const router = useRouter();
  const params = useLocalSearchParams<{ productId?: string; qty?: string; list?: string }>();
  const { session } = useAuth();

  const productId = String(params.productId || '');
  const quantity = Math.max(1, Number.parseInt(String(params.qty || '1'), 10) || 1);
  const listMode = String(params.list || '') === '1';

  const [orderItems, setOrderItems] = useState<Array<{ productId: string; quantity: number }>>([]);
  const [preview, setPreview] = useState<B2BCheckoutPreview | B2BCheckoutCartPreview | null>(null);
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
  const [bankReference, setBankReference] = useState<B2BBankTransferReference | null>(null);
  const [bankReferenceLoading, setBankReferenceLoading] = useState(false);
  const [bankReferenceError, setBankReferenceError] = useState('');
  const [bankReferenceRetry, setBankReferenceRetry] = useState(0);
  const [cardHolderName, setCardHolderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expireMonth, setExpireMonth] = useState('');
  const expireYearRef = useRef<TextInput>(null);
  const [expireYear, setExpireYear] = useState('');
  const [cvc, setCvc] = useState('');
  const cardRotation = useRef(new Animated.Value(0)).current;
  const flipCard = useCallback((showBack: boolean) => {
    Animated.timing(cardRotation, {
      toValue: showBack ? 1 : 0,
      duration: 420,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [cardRotation]);
  const frontRotation = cardRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotation = cardRotation.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const [installment, setInstallment] = useState(1);
  const [installments, setInstallments] = useState<B2BInstallmentLookup | null>(null);
  const [installmentsLoading, setInstallmentsLoading] = useState(false);
  const [installmentsError, setInstallmentsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkoutError,setCheckoutError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    if (!listMode && !productId) return;

    setLoading(true);
    setCheckoutError('');
    setPreview(null);
    try {
      let checkoutRequest: Promise<B2BCheckoutPreview | B2BCheckoutCartPreview>;

      if (listMode) {
        // A failed supplier lookup must never silently drop products from the payable total.
        // Fetch the signed-in customer's supplier lines independently from the local catalog.
        const [saved, supplierCart] = await Promise.all([
          getOrderList(),
          rmaApi.getMarketplaceCart(),
        ]);
        if (supplierCart.items.some(line => !line.valid)) {
          throw new Error('Sipariş listenizde fiyat, minimum koli veya stok bilgisi değişen ürünler var. Lütfen listeyi yenileyin.');
        }
        const own = saved.filter(item => !item.marketplaceProductId && !item.productId.startsWith('mp-'));
        const items = [
          ...own.map(item => ({ productId: item.productId, quantity: item.boxQuantity })),
          ...supplierCart.items.map(line => ({
            productId: 'mp-' + String(line.product_id),
            quantity: Number(line.boxes),
          })),
        ];

        if (!items.length) {
          throw new Error('Sipariş listeniz boş.');
        }

        setOrderItems(items);
        checkoutRequest = rmaApi.getB2BCheckoutCartPreview(items);
      } else {
        const items = [{ productId, quantity }];
        setOrderItems(items);
        checkoutRequest = rmaApi.getB2BCheckoutPreview(productId, quantity);
      }

      const [previewData, settingsData, addressData, accountData] = await Promise.all([
        checkoutRequest,
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
      const reason=error instanceof Error ? error.message : 'Sipariş bilgileri alınamadı.';
      setCheckoutError(reason);
      appAlert('Sipariş özeti hazırlanamadı',reason,undefined,'error');
    } finally {
      setLoading(false);
    }
  }, [listMode, productId, quantity, session]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibility=settings?.checkoutVisibility||{cargo:true,freight:true,pickup:true,card:true,bank_transfer:true};
  useEffect(()=>{
    const shipping=(["cargo","freight","pickup"] as const).find(option=>visibility[option]);
    if(!visibility[shippingMethod]&&shipping)setShippingMethod(shipping);
    const payment=(["card","bank_transfer"] as const).find(option=>visibility[option]);
    if(!visibility[paymentMethod]&&payment)setPaymentMethod(payment);
  },[visibility.cargo,visibility.freight,visibility.pickup,visibility.card,visibility.bank_transfer,shippingMethod,paymentMethod]);
  useEffect(()=>{
    if(!session)return;
    const timer=setInterval(()=>{
      void rmaApi.getB2BPaymentSettings().then(setSettings).catch(()=>undefined);
    },10000);
    return()=>clearInterval(timer);
  },[session]);

  useEffect(() => {
    const bin = cardNumber.replace(/\D/g, '').slice(0, 8);

    if (
      paymentMethod !== 'card' ||
      !preview ||
      bin.length !== 8
    ) {
      setInstallments(null);
      setInstallmentsError('');
      setInstallment(1);
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      setInstallmentsLoading(true);
      setInstallmentsError('');

      const request = listMode
        ? rmaApi.getB2BInstallmentsForItems({
            items: orderItems,
            binNumber: bin,
          })
        : rmaApi.getB2BInstallments({
            productId,
            quantity,
            binNumber: bin,
          });

      request
        .then((result) => {
          if (!active) return;
          setInstallments(result);
          const available = result.options || [];
          setInstallment((current) =>
            available.some((option) => option.installmentNumber === current)
              ? current
              : available[0]?.installmentNumber || 1,
          );
        })
        .catch((error) => {
          if (!active) return;
          setInstallments(null);
          setInstallment(1);
          setInstallmentsError(
            error instanceof Error ? error.message : 'Taksit seçenekleri alınamadı.',
          );
        })
        .finally(() => {
          if (active) setInstallmentsLoading(false);
        });
    }, 450);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [cardNumber, listMode, orderItems, paymentMethod, preview, productId, quantity]);

  // Reference is allocated server-side before an order exists. A payment reference
  // is not a paid invoice or proof of receiving a bank transfer.
  useEffect(() => {
    if (!session || !preview || preview.supplierPaymentEnabled === false || paymentMethod !== 'bank_transfer' ||
        !settings?.bankTransfer.enabled || bankReference || bankOrder) return;
    let active = true;
    setBankReferenceLoading(true);
    setBankReferenceError('');
    rmaApi.reserveB2BBankTransferCode()
      .then((reference) => { if (active) setBankReference(reference); })
      .catch((error) => {
        if (active) setBankReferenceError(
          error instanceof Error ? error.message : 'Havale kodu alınamadı.',
        );
      })
      .finally(() => { if (active) setBankReferenceLoading(false); });
    return () => { active = false; };
  }, [session, preview, paymentMethod, settings?.bankTransfer.enabled, bankReference, bankOrder, bankReferenceRetry]);

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

  const cardFormValid =
    cardHolderName.trim().length >= 2 &&
    validCardNumber(cardNumber) &&
    /^(0[1-9]|1[0-2])$/.test(expireMonth) &&
    /^\d{2}$/.test(expireYear) &&
    /^\d{3}$/.test(cvc);

  const selectedInstallment = installments?.options?.find(
    (option) => option.installmentNumber === installment,
  );
  const payableTotal = selectedInstallment?.totalPrice ?? preview?.total ?? 0;

  const canPay = Boolean(
    preview &&
      preview.supplierPaymentEnabled !== false &&
      selectedAddress &&
      shippingValid && visibility[shippingMethod] && visibility[paymentMethod] &&
      ((paymentMethod === 'card' &&
        settings?.iyzicoConfigured &&
        cardFormValid &&
        !installmentsLoading &&
        (!installments || installments.options.some((option) => option.installmentNumber === installment))) ||
        (paymentMethod === 'bank_transfer' && settings?.bankTransfer.enabled && Boolean(bankReference || bankOrder))),
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
      const paymentPayload = {
        addressId: selectedAddress.id,
        shipping: shippingPayload,
        mobileReturnUrl,
        installment,
        card: {
          cardHolderName: cardHolderName.trim(),
          cardNumber: cardNumber.replace(/\D/g, ''),
          expireMonth,
          expireYear,
          cvc,
        },
        checkoutContext: {
          source: listMode
            ? 'Çalışkan B2B Mobil · Sipariş Listesi'
            : 'Çalışkan B2B Mobil · Kart',
          entryPath: listMode
            ? '/checkout?list=1'
            : `/checkout?productId=${productId}&qty=${quantity}`,
          previousPath: listMode
            ? '/(tabs)/orders'
            : `/product/${productId}`,
          cartMode: listMode,
          productId: listMode ? null : productId,
          platform: 'mobile',
          installment,
        },
      };

      const result = listMode
        ? await rmaApi.initializeB2BThreeDSForItems({
            ...paymentPayload,
            items: orderItems,
          })
        : await rmaApi.initializeB2BThreeDS({
            ...paymentPayload,
            productId,
            quantity,
          });

      const html = result.threeDSHtml || '';
      if (!html.trim()) {
        throw new Error('3D Secure doğrulama ekranı hazırlanamadı.');
      }

      const storageKey = `caliskan_3ds_html_${result.orderNumber}`;
      await AsyncStorage.setItem(storageKey, html);

      router.push({
        pathname: '/payment-card',
        params: {
          mode: '3ds',
          order: result.orderNumber,
          storageKey,
          ...(listMode ? { clearList: '1' } : {}),
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

  const completeBankTransfer = async () => {
    if (!preview || !selectedAddress || !canPay || busy || (!bankReference && !bankOrder)) return;
    setBusy(true);
    try {
      const checkoutContext = {
        source: listMode
          ? 'Çalışkan B2B Mobil · Sipariş Listesi'
          : 'Çalışkan B2B Mobil',
        entryPath: listMode
          ? '/checkout?list=1'
          : `/checkout?productId=${productId}&qty=${quantity}`,
        previousPath: listMode
          ? '/(tabs)/orders'
          : `/product/${productId}`,
        cartMode: listMode,
        productId: listMode ? null : productId,
        platform: 'mobile',
      };

      // Retrying with the same reserved reference must never create another order.
      let order = bankOrder;
      if (!order) {
        if (!bankReference) return;
        order = listMode
          ? await rmaApi.createB2BBankTransferOrderForItems({
              reservationId: bankReference.reservationId,
              items: orderItems,
              addressId: selectedAddress.id,
              shipping: shippingPayload,
              checkoutContext,
            })
          : await rmaApi.createB2BBankTransferOrder({
              reservationId: bankReference.reservationId,
              productId,
              quantity,
              addressId: selectedAddress.id,
              shipping: shippingPayload,
              checkoutContext,
            });
        setBankOrder(order);
      }

      // Customer claim only: the bank transfer is NOT considered verified here.
      await rmaApi.confirmB2BBankTransfer(order.orderNumber);
      if (listMode) await clearOrderList();
      router.replace({
        pathname: '/payment-result',
        params: { result: 'success', order: order.orderNumber, method: 'bank_transfer' },
      } as never);
    } catch (error) {
      appAlert(
        'Havale bildirimi tamamlanamadı',
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
      <Screen style={{ backgroundColor: palette.background }}>
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

  if (!loading && checkoutError) {
    return (
      <Screen style={{backgroundColor:palette.background}}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={34} color={palette.textSecondary}/>
          <Text style={styles.centerTitle}>Sipariş özeti hazırlanamadı</Text>
          <Text style={[styles.centerText,{textAlign:'center'}]}>{checkoutError}</Text>
          <Pressable style={styles.primaryButton} onPress={()=>void load()}>
            <Text style={styles.primaryButtonText}>Yeniden Dene</Text>
          </Pressable>
          <Pressable onPress={()=>router.back()} style={{padding:14}}>
            <Text style={{color:palette.textSecondary}}>Sipariş listesine dön</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (loading || !preview) {
    return (
      <Screen style={{ backgroundColor: palette.background }}>
        <View style={styles.center}>
          <Ionicons name="bag-check-outline" size={38} color={palette.muted} />
          <Text style={styles.centerTitle}>Ödeme hazırlanıyor…</Text>
        </View>
      </Screen>
    );
  }

  const checkoutLines =
    'items' in preview
      ? preview.items
      : [
          {
            product: preview.product,
            quantity: preview.quantity,
            totalUnits: preview.totalUnits,
            total: preview.total,
          },
        ];

  return (
    <Screen style={{ backgroundColor: palette.background }}>
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={palette.textSecondary} />
          <Text style={styles.backText}>Ürüne dön</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>GÜVENLİ ÖDEME</Text>
          <Text style={styles.title}>Siparişi Tamamla</Text>
          <Text style={styles.subtitle}>
            Teslimat ve ödeme bilgilerinizi kontrol ederek siparişinizi tamamlayın.
          </Text>
        </View>

        {preview.supplierPaymentEnabled === false ? (
          <View style={[styles.installmentInfo, { marginBottom: spacing.md }]}>
            <Ionicons name="information-circle-outline" size={20} color={colors.warning} />
            <Text style={styles.installmentInfoText}>
              {preview.supplierPaymentNotice || 'Tedarikçi ürünleri için online ödeme şu anda kullanılamıyor.'}
            </Text>
          </View>
        ) : null}

        <Section title="Sipariş Özeti" icon="bag-handle-outline" collapsible defaultCollapsed summaryValue={money(paymentMethod === 'card' ? payableTotal : preview.total)}>
          {checkoutLines.map((line, index) => {
            const lineImage = absoluteMediaUrl(line.product.image);
            return (
              <View
                key={String(line.product.id)}
                style={[
                  styles.productRow,
                  index > 0 && styles.productRowDivider,
                ]}
              >
                <View style={styles.productImageWrap}>
                  {lineImage ? (
                    <Image
                      source={{ uri: lineImage }}
                      style={styles.productImage}
                      contentFit="contain"
                    />
                  ) : (
                    <Ionicons
                      name="cube-outline"
                      size={34}
                      color={palette.muted}
                    />
                  )}
                </View>
                <View style={styles.productText}>
                  <Text style={styles.productSku}>
                    {line.product.sku || 'STOK'}
                  </Text>
                  <Text style={styles.productName}>{line.product.name}</Text>
                  {line.product.sellerName ? (
                    <Text numberOfLines={1} style={styles.productMeta}>Satıcı: {line.product.sellerName}</Text>
                  ) : null}
                  <Text style={styles.productMeta}>
                    {line.quantity} koli × {line.product.unitsPerBox} adet ={' '}
                    {line.totalUnits} adet
                  </Text>
                </View>
                <Text style={styles.lineTotal}>{money(line.total)}</Text>
              </View>
            );
          })}

          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Ürün toplamı</Text>
            <Text style={styles.summaryValue}>{money(preview.total)}</Text>
          </View>
          <View style={[styles.summaryLine, styles.summaryTotal]}>
            <Text style={styles.totalLabel}>Ödenecek toplam</Text>
            <Text style={styles.totalValue}>
              {money(paymentMethod === 'card' ? payableTotal : preview.total)}
            </Text>
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
            <Ionicons name="add" size={18} color={palette.text} />
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
          {visibility.cargo?<ChoiceCard
            active={shippingMethod === 'cargo'}
            title="PTT Kargo"
            subtitle="Siparişiniz kayıtlı teslimat adresinize gönderilir."
            icon="cube-outline"
            onPress={() => setShippingMethod('cargo')}
          />:null}
          {visibility.freight?<ChoiceCard
            active={shippingMethod === 'freight'}
            title="Ambar"
            subtitle="Belirttiğiniz ambar firmasına teslim edilir."
            icon="trail-sign-outline"
            onPress={() => setShippingMethod('freight')}
          />:null}
          {shippingMethod === 'freight' && visibility.freight ? (
            <View style={styles.formBox}>
              <Input label="Ambar Firma Adı" value={freightCompany} onChangeText={setFreightCompany} />
              <Input label="Ambar Telefonu" value={freightPhone} onChangeText={setFreightPhone} keyboardType="phone-pad" />
            </View>
          ) : null}
          {visibility.pickup?<ChoiceCard
            active={shippingMethod === 'pickup'}
            title="Depodan Teslim"
            subtitle="Siparişinizi Çalışkan deposundan teslim alın."
            icon="storefront-outline"
            onPress={() => setShippingMethod('pickup')}
          />:null}
          {shippingMethod === 'pickup' && visibility.pickup ? (
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
          {settings?.iyzicoConfigured && visibility.card ? (
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

          {settings?.bankTransfer.enabled && visibility.bank_transfer ? (
            <ChoiceCard
              active={paymentMethod === 'bank_transfer'}
              title="Havale / EFT"
              subtitle="Sipariş kodunuzla banka transferi yapın."
              icon="business-outline"
              onPress={() => setPaymentMethod('bank_transfer')}
            />
          ) : null}

          {settings?.paymentLogos?.length ? (
            <View style={styles.paymentLogoGallery}>
              {settings.paymentLogos.map(logo => (
                <View key={logo.id} style={styles.paymentLogoItem}>
                  <Image
                    source={{uri:homepageMediaUrl(logo.imageId)||''}}
                    style={styles.paymentLogoImage}
                    contentFit="contain"
                  />
                  {logo.label ? <Text numberOfLines={1} style={styles.paymentLogoTitle}>{logo.label}</Text>:null}
                </View>
              ))}
            </View>
          ) : null}

          {paymentMethod === 'card' ? (
            <View style={styles.cardPaymentBox}>
              <View style={styles.secureBox}>
                <View style={styles.secureIcon}>
                  <Ionicons name="shield-checkmark" size={24} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.secureTitle}>iyzico 3D Secure Kart Ödemesi</Text>
                  <Text style={styles.secureText}>
                    Kart bilgileriniz yalnızca ödeme işlemi için iyzico'ya iletilir; Çalışkan B2B tarafından saklanmaz.
                  </Text>
                </View>
              </View>

              <View style={styles.cardFlipContainer}>
                <Animated.View style={[styles.cardVisual, styles.cardFace, { transform: [{ rotateY: frontRotation }] }]}>
                  <View style={styles.cardVisualTop}>
                    <Text style={styles.cardBrandText}>
                      {installments?.cardAssociation || 'Banka / Kredi Kartı'}
                    </Text>
                    <Text style={styles.cardBankName} numberOfLines={1}>
                      {installments?.bankName || 'BANKA'}
                    </Text>
                  </View>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.cardNumberPreview}>
                    {formatCardNumber(cardNumber) || '•••• •••• •••• ••••'}
                  </Text>
                  <View style={styles.cardVisualBottom}>
                    <View>
                      <Text style={styles.cardMetaLabel}>KART SAHİBİ</Text>
                      <Text style={styles.cardMetaValue}>
                        {cardHolderName.trim().toUpperCase() || 'İSİM SOYİSİM'}
                      </Text>
                    </View>
                    <View style={styles.cardExpiryPreview}>
                      <Text style={styles.cardMetaLabel}>SKT</Text>
                      <Text style={styles.cardMetaValue}>
                        {expireMonth || 'AA'}/{expireYear || 'YY'}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
                <Animated.View style={[styles.cardVisual, styles.cardFace, styles.cardBack, { transform: [{ rotateY: backRotation }] }]}>
                  <View style={styles.cardMagneticStrip} />
                  <View style={styles.cardCvvRow}>
                    <View style={styles.cardSignatureStrip} />
                    <View style={styles.cardCvvBox}>
                      <Text style={styles.cardCvvLabel}>CVV</Text>
                      <Text style={styles.cardCvvValue}>{cvc || '•••'}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardBackHint}>Kart güvenlik kodu</Text>
                </Animated.View>
              </View>

              <View style={styles.cardFields}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Kart Üzerindeki İsim Soyisim</Text>
                  <TextInput
                    value={cardHolderName}
                    onChangeText={setCardHolderName}
                    autoCapitalize="words"
                    autoCorrect={false}
                    placeholder="İsim Soyisim"
                    placeholderTextColor={palette.muted}
                    style={styles.input}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Kart Numarası</Text>
                  <TextInput
                    value={formatCardNumber(cardNumber)}
                    onChangeText={(value) =>
                      setCardNumber(value.replace(/\D/g, '').slice(0, 16))
                    }
                    keyboardType="number-pad"
                    placeholder="0000 0000 0000 0000"
                    placeholderTextColor={palette.muted}
                    style={styles.input}
                    maxLength={19}
                  />
                  <Text style={styles.cardFieldHint}>
                    {cardNumber.replace(/\D/g, '').length}/16 hane · Kart numarası 16 hane olmalıdır.
                  </Text>
                </View>

                <View style={styles.cardDateRow}>
                  <View style={styles.cardDateField}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Ay</Text>
                      <TextInput
                        value={expireMonth}
                        onChangeText={(value) => {
                          const digits = value.replace(/\D/g, '').slice(0, 2);
                          setExpireMonth(digits);
                          if (digits.length === 2) expireYearRef.current?.focus();
                        }}
                        keyboardType="number-pad"
                        placeholder="AA"
                        placeholderTextColor={palette.muted}
                        style={styles.input}
                        maxLength={2}
                      />
                    </View>
                  </View>

                  <View style={styles.cardDateField}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Yıl</Text>
                      <TextInput
                        ref={expireYearRef}
                        value={expireYear}
                        onChangeText={(value) =>
                          setExpireYear(value.replace(/\D/g, '').slice(0, 2))
                        }
                        keyboardType="number-pad"
                        placeholder="YY"
                        placeholderTextColor={palette.muted}
                        style={styles.input}
                        maxLength={2}
                      />
                    </View>
                  </View>

                  <View style={styles.cardDateField}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>CVV</Text>
                      <TextInput
                        value={cvc}
                        onFocus={() => flipCard(true)}
                        onBlur={() => flipCard(false)}
                        onChangeText={(value) =>
                          setCvc(value.replace(/\D/g, '').slice(0, 3))
                        }
                        keyboardType="number-pad"
                        placeholder="***"
                        placeholderTextColor={palette.muted}
                        style={styles.input}
                        secureTextEntry
                        maxLength={3}
                      />
                      <Text style={styles.cardFieldHint}>CVV 3 rakamdır.</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.installmentSection}>
                <View style={styles.installmentHeader}>
                  <View>
                    <Text style={styles.installmentTitle}>Taksit Seçenekleri</Text>
                    <Text style={styles.installmentSubtitle}>
                      Kartın ilk 8 hanesine göre iyzico üzerinden hesaplanır.
                    </Text>
                  </View>

                </View>

                {cardNumber.replace(/\D/g, '').length < 8 ? (
                  <View style={styles.installmentInfo}>
                    <Ionicons name="information-circle-outline" size={19} color={palette.textSecondary} />
                    <Text style={styles.installmentInfoText}>
                      Taksit oranlarını görmek için kart numarasının ilk 8 hanesini girin.
                    </Text>
                  </View>
                ) : installmentsLoading ? (
                  <View style={styles.installmentInfo}>
                    <Ionicons name="sync-outline" size={19} color={palette.textSecondary} />
                    <Text style={styles.installmentInfoText}>Taksit seçenekleri sorgulanıyor…</Text>
                  </View>
                ) : installmentsError ? (
                  <View style={styles.installmentInfo}>
                    <Ionicons name="alert-circle-outline" size={19} color={colors.warning} />
                    <Text style={styles.installmentInfoText}>{installmentsError}</Text>
                  </View>
                ) : (
                  <View style={styles.installmentGrid}>
                    {(installments?.options || []).map((option) => {
                      const active = option.installmentNumber === installment;
                      return (
                        <Pressable
                          key={option.installmentNumber}
                          style={[
                            styles.installmentCard,
                            active && styles.installmentCardActive,
                          ]}
                          onPress={() => setInstallment(option.installmentNumber)}
                        >
                          <View style={styles.installmentCardTop}>
                            <Text
                              style={[
                                styles.installmentCount,
                                active && styles.installmentTextActive,
                              ]}
                            >
                              {option.installmentNumber === 1
                                ? 'Tek Çekim'
                                : `${option.installmentNumber} Taksit`}
                            </Text>
                            <View style={[styles.radio, active && styles.radioActive]}>
                              {active ? <View style={styles.radioDot} /> : null}
                            </View>
                          </View>
                          <Text
                            style={[
                              styles.installmentAmount,
                              active && styles.installmentTextActive,
                            ]}
                          >
                            {option.installmentNumber === 1
                              ? money(option.totalPrice)
                              : `${money(option.installmentPrice)} × ${option.installmentNumber}`}
                          </Text>
                          <Text
                            style={[
                              styles.installmentRate,
                              active && styles.installmentRateActive,
                            ]}
                          >
                            {option.commissionRate > 0
                              ? `+% ${option.commissionRate.toLocaleString('tr-TR')}`
                              : 'Komisyonsuz'}
                            {' · '}
                            Toplam {money(option.totalPrice)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          ) : null}

          {paymentMethod === 'bank_transfer' ? (
            <View style={styles.bankPreview}>
              <InfoLine label="Banka" value={settings?.bankTransfer.bankName || '—'} />
              <CopyRow
                label="İsim Soyisim / Hesap Sahibi"
                value={settings?.bankTransfer.accountHolder || '—'}
              />
              <CopyRow label="IBAN" value={settings?.bankTransfer.iban || '—'} />
              {bankReference || bankOrder ? (
                <>
                  <Text style={styles.transferCodeLabel}>Havale açıklama kodunuz</Text>
                  <CopyRow
                    label="Açıklamaya yazılacak CLK kodu"
                    value={bankOrder?.transferCode || bankReference?.transferCode || ''}
                  />
                  <View style={styles.transferCodeBox}>
                    <Text style={styles.transferCodeValue}>
                      {bankOrder?.transferCode || bankReference?.transferCode}
                    </Text>
                  </View>
                  <Text style={styles.bankPreviewHint}>
                    Havale/EFT açıklamasına yalnızca bu CLK kodunu yazın. Kodunuz sipariş
                    tamamlanmadan önce ayrılmıştır. Ödemenin bankadan doğrulanması ayrıca yapılır.
                  </Text>
                </>
              ) : (
                <View style={styles.bankCodePending}>
                  <Text style={styles.bankPreviewHint}>
                    {bankReferenceLoading
                      ? 'Size özel CLK kodu hazırlanıyor…'
                      : bankReferenceError || 'Havale kodu bekleniyor…'}
                  </Text>
                  {bankReferenceError ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setBankReferenceRetry((value) => value + 1)}
                    >
                      <Text style={styles.retryText}>Kodu Tekrar Al</Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            </View>
          ) : null}
        </Section>

        {!selectedAddress ? (
          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={20} color="#92400E" />
            <Text style={styles.warningText}>Siparişi tamamlamak için teslimat adresi ekleyin.</Text>
          </View>
        ) : null}

        {!shippingValid ? (
          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={20} color="#92400E" />
            <Text style={styles.warningText}>Ambar firma adı ve telefonunu tamamlayın.</Text>
          </View>
        ) : null}

        <Pressable
            style={[styles.payButton, !canPay && styles.disabled]}
            disabled={!canPay || busy}
            onPress={paymentMethod === 'card' ? startCardPayment : completeBankTransfer}
          >
            <Ionicons
              name={paymentMethod === 'card' ? 'lock-closed' : 'business'}
              size={19}
              color="#111827"
            />
            <Text style={styles.payButtonText}>
              {busy
                ? 'Hazırlanıyor…'
                : paymentMethod === 'card'
                  ? `${money(payableTotal)} · Ödemeyi Tamamla`
                  : `${money(preview.total)} · Ödemeyi Tamamladım`}
            </Text>
          </Pressable>
        {paymentMethod === 'bank_transfer' ? (
          <Text style={styles.bankPreviewHint}>
            Ödemeyi Tamamladım butonuna bastığınızda sipariş oluşturulur ve havale
            bildiriminiz yöneticiye iletilir. Para girişi doğrulanana kadar ödeme beklemededir.
          </Text>
        ) : null}

        <View style={styles.securityFooter}>
          <Ionicons name="shield-checkmark-outline" size={18} color={palette.muted} />
          <Text style={styles.securityText}>
            Ödeme bilgileri güvenli bağlantı üzerinden işlenir.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Section({
  title, icon, children, collapsible = false, defaultCollapsed = false, summaryValue,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  summaryValue?: string;
}) {
  const { palette } = useAppearance();
  const styles = useMemo(() => buildStyles(palette), [palette]);
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const header = (
    <>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={19} color={palette.text} />
      </View>
      <Text style={[styles.sectionTitle,{flex:1}]}>{title}</Text>
      {collapsible && !expanded && summaryValue ? <Text style={styles.summaryCollapsedTotal}>{summaryValue}</Text>:null}
      {collapsible ? <Ionicons name={expanded?'chevron-up':'chevron-down'} color={palette.text} size={20}/>:null}
    </>
  );
  return (
    <View style={styles.section}>
      {collapsible ? (
        <Pressable style={styles.sectionHeader} accessibilityRole="button"
          accessibilityState={{expanded}} onPress={() => setExpanded(current=>!current)}>
          {header}
        </Pressable>
      ) : <View style={styles.sectionHeader}>{header}</View>}
      {expanded ? <View style={styles.sectionBody}>{children}</View>:null}
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
  const { palette } = useAppearance();
  const styles = useMemo(() => buildStyles(palette), [palette]);
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
  const { palette } = useAppearance();
  const styles = useMemo(() => buildStyles(palette), [palette]);
  return (
    <Pressable style={[styles.choiceCard, active && styles.choiceCardActive]} onPress={onPress}>
      <View style={[styles.choiceIcon, active && styles.choiceIconActive]}>
        <Ionicons name={icon} size={20} color={active ? '#111827' : palette.text} />
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
  const { palette } = useAppearance();
  const styles = useMemo(() => buildStyles(palette), [palette]);
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMultiline]}
        placeholderTextColor={palette.muted}
      />
    </View>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const { palette } = useAppearance();
  const styles = useMemo(() => buildStyles(palette), [palette]);
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
      <Ionicons name="copy-outline" size={19} color={palette.textSecondary} />
    </Pressable>
  );
}

const buildStyles = (palette: AppPalette) => StyleSheet.create({
  page: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  back: {
    minHeight: minTouchTarget,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  backText: { ...typography.bodyMedium, color: palette.textSecondary },
  header: { marginTop: spacing.lg, marginBottom: spacing.xl },
  eyebrow: { ...typography.caption, color: palette.muted, fontWeight: '800', letterSpacing: 1.2 },
  title: { ...typography.largeTitle, color: palette.text, fontWeight: '900', marginTop: spacing.xs },
  subtitle: { ...typography.body, color: palette.textSecondary, marginTop: spacing.xs },
  section: { borderRadius: radius.xl, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, overflow: 'hidden', marginBottom: spacing.md },
  sectionHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: palette.border },
  sectionIcon: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: palette.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { ...typography.subtitle, color: palette.text, fontWeight: '900' },
  summaryCollapsedTotal: { fontSize: 12, color: palette.text, fontWeight: '900' },
  sectionBody: { padding: spacing.lg, gap: spacing.sm },
  productRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  productRowDivider: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: spacing.md,
    marginTop: spacing.md,
  },
  productImageWrap: { width: 76, height: 76, borderRadius: radius.md, backgroundColor: '#FAFAFA', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  productImage: { width: '100%', height: '100%' },
  productText: { flex: 1 },
  productSku: { ...typography.caption, color: palette.muted },
  productName: { ...typography.bodyMedium, color: palette.text, fontWeight: '800', marginTop: 2 },
  productMeta: { ...typography.caption, color: palette.textSecondary, marginTop: spacing.xs },
  lineTotal: { ...typography.bodyMedium, color: palette.text, fontWeight: '900' },
  summaryLine: { minHeight: 44, borderTopWidth: 1, borderTopColor: palette.border, marginTop: spacing.sm, paddingTop: spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { ...typography.body, color: palette.textSecondary },
  summaryValue: { ...typography.bodyMedium, color: palette.text, fontWeight: '800' },
  summaryTotal: { minHeight: 52 },
  totalLabel: { ...typography.subtitle, color: palette.text, fontWeight: '900' },
  totalValue: { ...typography.title, color: palette.text, fontWeight: '900' },
  infoLine: { minHeight: 50, borderBottomWidth: 1, borderBottomColor: palette.border, justifyContent: 'center' },
  infoLineLabel: { ...typography.caption, color: palette.muted },
  infoLineValue: { ...typography.bodyMedium, color: palette.text, fontWeight: '700', marginTop: 2 },
  selectCard: { minHeight: 76, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  selectCardActive: { borderColor: '#FACC15', borderWidth: 2, backgroundColor: palette.surfaceSecondary },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: '#D4A800' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FACC15' },
  selectText: { flex: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  selectTitle: { ...typography.bodyMedium, color: palette.text, fontWeight: '800' },
  selectSubtitle: { ...typography.caption, color: palette.textSecondary, marginTop: 3 },
  badge: { ...typography.caption, color: palette.text, backgroundColor: palette.surfaceSecondary, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full, overflow: 'hidden' },
  outlineButton: { minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  outlineButtonText: { ...typography.bodyMedium, color: palette.text, fontWeight: '800' },
  formBox: { borderRadius: radius.lg, backgroundColor: palette.surfaceSecondary, padding: spacing.md, gap: spacing.md },
  inputGroup: { gap: spacing.xs },
  inputLabel: { ...typography.caption, color: palette.textSecondary, fontWeight: '700' },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, paddingHorizontal: spacing.md, ...typography.body, color: palette.text },
  inputMultiline: { minHeight: 92, paddingTop: spacing.md, textAlignVertical: 'top' },
  twoColumns: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  choiceCard: { minHeight: 74, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  choiceCardActive: { borderColor: '#FACC15', borderWidth: 2, backgroundColor: palette.surfaceSecondary },
  choiceIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: palette.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  choiceIconActive: { backgroundColor: '#FACC15' },
  choiceTitle: { ...typography.bodyMedium, color: palette.text, fontWeight: '800' },
  choiceSubtitle: { ...typography.caption, color: palette.muted, marginTop: 2 },
  pickupTimes: { flexDirection: 'row', gap: spacing.sm },
  timeChip: { flex: 1, minHeight: 42, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  timeChipActive: { backgroundColor: '#FACC15', borderColor: '#FACC15' },
  timeText: { ...typography.bodyMedium, color: palette.text },
  timeTextActive: { color: '#111827' },
  cardPaymentBox: {
    gap: spacing.md,
  },
  paymentLogoGallery: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  paymentLogoItem: { width: 104, borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, padding: 5, alignItems: 'center', backgroundColor: palette.surface },
  paymentLogoImage: { width: 88, height: 44 },
  paymentLogoTitle: { fontSize: 10, color: palette.textSecondary, marginTop: 3, textAlign: 'center' },
  secureBox: { borderRadius: radius.lg, backgroundColor: palette.surfaceSecondary, padding: spacing.md, flexDirection: 'row', gap: spacing.md },
  secureIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  secureTitle: { ...typography.bodyMedium, color: palette.text, fontWeight: '800' },
  secureText: { ...typography.caption, color: palette.textSecondary, marginTop: 2, lineHeight: 18 },
  cardFlipContainer: { height: 190, position: 'relative' },
  cardFace: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backfaceVisibility: 'hidden' },
  cardBankName: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', textAlign: 'right', flexShrink: 1, maxWidth: '50%' },
  cardBack: { paddingHorizontal: 0, paddingVertical: spacing.lg },
  cardMagneticStrip: { height: 40, backgroundColor: '#05070C', width: '100%' },
  cardCvvRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, gap: spacing.sm },
  cardSignatureStrip: { flex: 1, height: 40, backgroundColor: '#E5E7EB', borderRadius: 3 },
  cardCvvBox: { minWidth: 75, backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4 },
  cardCvvLabel: { color: '#334155', fontSize: 9, fontWeight: '700' },
  cardCvvValue: { color: '#111827', fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  cardBackHint: { color: '#CBD5E1', fontSize: 11, marginHorizontal: spacing.lg },
  cardVisual: {
    minHeight: 190,
    borderRadius: radius.xl,
    backgroundColor: '#111827',
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  cardVisualTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardBrandText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  cardNumberPreview: {
    fontSize: 20,
    lineHeight: 26,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.9,
    marginVertical: spacing.lg,
  },
  cardVisualBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  cardExpiryPreview: {
    alignItems: 'flex-end',
  },
  cardMetaLabel: {
    fontSize: 9,
    lineHeight: 12,
    color: '#94A3B8',
    fontWeight: '800',
    letterSpacing: 1,
  },
  cardMetaValue: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '800',
    marginTop: 3,
  },
  cardFields: {
    borderRadius: radius.lg,
    backgroundColor: palette.surfaceSecondary,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardFieldHint: { fontSize: 11, color: palette.textSecondary, marginTop: 3 },
  cardDateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cardDateField: {
    flex: 1,
  },
  installmentSection: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.md,
    gap: spacing.md,
  },
  installmentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  installmentTitle: {
    ...typography.bodyMedium,
    color: palette.text,
    fontWeight: '900',
  },
  installmentSubtitle: {
    ...typography.caption,
    color: palette.muted,
    marginTop: 2,
  },
  bankBadge: {
    ...typography.caption,
    color: palette.text,
    fontWeight: '800',
    backgroundColor: palette.surfaceSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  installmentInfo: {
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceSecondary,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  installmentInfoText: {
    ...typography.caption,
    color: palette.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  installmentGrid: {
    gap: spacing.sm,
  },
  installmentCard: {
    minHeight: 78,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.md,
  },
  installmentCardActive: {
    borderColor: '#FACC15',
    borderWidth: 2,
    backgroundColor: '#FACC15',
  },
  installmentCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  installmentCount: {
    ...typography.bodyMedium,
    color: palette.text,
    fontWeight: '900',
  },
  installmentAmount: {
    ...typography.bodyMedium,
    color: palette.text,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  installmentRate: {
    ...typography.caption,
    color: palette.muted,
    marginTop: 2,
  },
  installmentTextActive: {
    color: '#111827',
  },
  installmentRateActive: {
    color: '#374151',
  },
  bankPreview: { borderRadius: radius.lg, backgroundColor: palette.surfaceSecondary, paddingHorizontal: spacing.md },
  bankCodePending: { paddingVertical: spacing.sm },
  retryText: { color: '#FACC15', fontWeight: '800', paddingBottom: spacing.md },
  bankPreviewHint: {
    ...typography.caption,
    color: palette.textSecondary,
    lineHeight: 18,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  bankOrder: { borderRadius: radius.lg, backgroundColor: palette.surfaceSecondary, padding: spacing.lg, alignItems: 'stretch' },
  successMark: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  bankOrderTitle: { ...typography.subtitle, color: palette.text, fontWeight: '900', textAlign: 'center', marginTop: spacing.sm },
  orderCode: { ...typography.title, color: palette.text, fontWeight: '900', textAlign: 'center', marginVertical: spacing.md },
  transferCodeBox: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.md,
    alignItems: 'center',
  },
  transferCodeLabel: {
    ...typography.caption,
    color: palette.muted,
  },
  transferCodeValue: {
    fontSize: 24,
    lineHeight: 30,
    color: palette.text,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: spacing.xs,
  },
  copyRow: { minHeight: 60, borderTopWidth: 1, borderTopColor: palette.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copyLabel: { ...typography.caption, color: palette.muted },
  copyValue: { ...typography.bodyMedium, color: palette.text, fontWeight: '800', marginTop: 2 },
  bankHint: { ...typography.caption, color: palette.textSecondary, marginTop: spacing.md, textAlign: 'center' },
  warningBox: { borderRadius: radius.md, backgroundColor: '#FFF7DD', borderColor: '#D97706', borderWidth: 1, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  warningText: { ...typography.caption, color: '#713F12', fontWeight: '700', flex: 1, lineHeight: 20 },
  payButton: { minHeight: 58, borderRadius: radius.lg, backgroundColor: '#FACC15', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  payButtonText: { ...typography.bodyMedium, color: '#111827', fontWeight: '900' },
  primaryButton: { minHeight: 50, borderRadius: radius.md, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  primaryButtonText: { ...typography.bodyMedium, color: '#FFFFFF', fontWeight: '800' },
  disabled: { opacity: 0.45 },
  securityFooter: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  securityText: { ...typography.caption, color: palette.muted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl },
  centerIcon: { width: 64, height: 64, borderRadius: radius.full, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  centerTitle: { ...typography.title, color: palette.text, fontWeight: '900', textAlign: 'center', marginTop: spacing.lg },
  centerText: { ...typography.body, color: palette.textSecondary, textAlign: 'center', marginTop: spacing.sm },
});
