import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { FormField } from '@/components/forms/FormField';
import { ProductImagePicker } from '@/components/forms/ProductImagePicker';
import { StepIndicator } from '@/components/forms/StepIndicator';
import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { CATEGORY_OPTIONS, getCategoryLabel } from '@/constants/statuses';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { useCatalogCustomers, useCatalogProducts, useCustomers } from '@/hooks/useRmaData';
import { rmaApi, type CatalogCustomer, type CatalogProduct, type RmaCustomer } from '@/lib/api';
import { uploadProductPhoto } from '@/lib/attachments';
import { recordHref } from '@/lib/routes';

type CustomerForm = {
  customerName: string;
  accountCode: string;
  phone: string;
  email: string;
  address: string;
};

type CustomerOption = {
  key: string;
  source: 'catalog' | 'rma';
  id: number;
  name: string;
  accountCode: string;
  phone: string;
  email: string;
  address: string;
  ticketCount?: number;
};

type ProductDraft = {
  id: string;
  productName: string;
  brand: string;
  model: string;
  serialNumber: string;
  quantity: string;
  stockCode: string;
  category: 'iade' | 'degisim' | 'servis';
  description: string;
  imageUri?: string | null;
};

const emptyProductDraft = (): ProductDraft => ({
  id: `${Date.now()}-${Math.random()}`,
  productName: '',
  stockCode: '',
  brand: '',
  model: '',
  serialNumber: '',
  quantity: '1',
  category: 'servis',
  description: '',
  imageUri: null,
});

const emptyCustomer: CustomerForm = {
  customerName: '',
  accountCode: '',
  phone: '',
  email: '',
  address: '',
};

function useDebouncedValue(value: string, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [delay, value]);

  return debounced;
}

function catalogCustomerToOption(item: CatalogCustomer): CustomerOption {
  return {
    key: `catalog-${item.id}`,
    source: 'catalog',
    id: item.id,
    name: item.accountName,
    accountCode: item.accountCode,
    phone: '',
    email: '',
    address: '',
  };
}

function rmaCustomerToOption(item: RmaCustomer): CustomerOption {
  return {
    key: `rma-${item.id}`,
    source: 'rma',
    id: item.id,
    name: item.name || 'İsimsiz müşteri',
    accountCode: item.accountCode || '',
    phone: item.phone || '',
    email: item.email || '',
    address: item.address || '',
    ticketCount: item.ticketCount,
  };
}

export default function NewRmaScreen() {
  const router = useRouter();
  const { customers: rmaCustomers, refresh: refreshCustomers } = useCustomers();

  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState<CustomerForm>(emptyCustomer);
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [showCustomerResults, setShowCustomerResults] = useState(true);

  const debouncedCustomerQuery = useDebouncedValue(customerQuery);
  const {
    customers: catalogCustomers,
    loading: catalogCustomersLoading,
    error: catalogCustomersError,
  } = useCatalogCustomers(debouncedCustomerQuery);

  const [products, setProducts] = useState<ProductDraft[]>([]);
  const [draft, setDraft] = useState<ProductDraft>(emptyProductDraft);
  const [productQuery, setProductQuery] = useState('');
  const [showProductResults, setShowProductResults] = useState(false);
  const [selectedCatalogProductId, setSelectedCatalogProductId] = useState<number | null>(null);

  const debouncedProductQuery = useDebouncedValue(productQuery);
  const {
    products: catalogProducts,
    loading: catalogProductsLoading,
    error: catalogProductsError,
  } = useCatalogProducts(debouncedProductQuery);

  const [submitting, setSubmitting] = useState(false);

  const customerOptions = useMemo(() => {
    const q = debouncedCustomerQuery.trim().toLocaleLowerCase('tr-TR');

    const catalogOptions = catalogCustomers.map(catalogCustomerToOption);
    const historicOptions = rmaCustomers
      .filter((item) => {
        if (!q) return true;
        return [item.name, item.accountCode, item.phone, item.email]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('tr-TR')
          .includes(q);
      })
      .map(rmaCustomerToOption);

    const seen = new Set<string>();
    const merged: CustomerOption[] = [];

    for (const option of [...catalogOptions, ...historicOptions]) {
      const identity = option.accountCode
        ? `code:${option.accountCode.toLocaleLowerCase('tr-TR')}`
        : `name:${option.name.toLocaleLowerCase('tr-TR')}|${option.phone}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      merged.push(option);
      if (merged.length >= 12) break;
    }

    return merged;
  }, [catalogCustomers, debouncedCustomerQuery, rmaCustomers]);

  const updateCustomer = (key: keyof CustomerForm, value: string) => {
    setSelectedCustomerKey(null);
    setCustomer((prev) => ({ ...prev, [key]: value }));
  };

  const selectCustomer = (item: CustomerOption) => {
    setSelectedCustomerKey(item.key);
    setCustomer({
      customerName: item.name,
      accountCode: item.accountCode,
      phone: item.phone,
      email: item.email,
      address: item.address,
    });
    setCustomerQuery([item.accountCode, item.name].filter(Boolean).join(' · '));
    setShowCustomerResults(false);
  };

  const updateDraft = (key: keyof ProductDraft, value: string | null) => {
    if (key === 'stockCode' || key === 'productName') {
      setSelectedCatalogProductId(null);
    }
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const selectCatalogProduct = (item: CatalogProduct) => {
    setSelectedCatalogProductId(item.id);
    setDraft((prev) => ({
      ...prev,
      stockCode: item.stockCode,
      productName: item.stockName,
    }));
    setProductQuery(`${item.stockCode} · ${item.stockName}`);
    setShowProductResults(false);
  };

  const addProduct = () => {
    if (!draft.productName.trim()) {
      Alert.alert('Eksik bilgi', 'Listeden bir ürün seçin veya ürün adını girin.');
      return;
    }

    const quantity = Number(draft.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) {
      Alert.alert('Geçersiz miktar', 'Miktar en az 1 olmalıdır.');
      return;
    }

    setProducts((prev) => [...prev, { ...draft, quantity: String(Math.floor(quantity)) }]);
    setDraft(emptyProductDraft());
    setProductQuery('');
    setSelectedCatalogProductId(null);
    setShowProductResults(false);
  };

  const removeProduct = (id: string) => {
    setProducts((prev) => prev.filter((item) => item.id !== id));
  };

  const updateProductImage = (id: string, imageUri: string | null) => {
    setProducts((prev) => prev.map((item) => (item.id === id ? { ...item, imageUri } : item)));
  };

  const canContinue = () => {
    if (step === 1) return customer.customerName.trim().length > 0;
    if (step === 2) return products.length > 0;
    return true;
  };

  const goNext = () => {
    if (step === 1 && !customer.customerName.trim()) {
      Alert.alert('Müşteri seçin', 'Kayıtlı cari listesinden müşteri seçin veya müşteri adını girin.');
      return;
    }
    if (step === 2 && products.length === 0) {
      Alert.alert('Ürün ekleyin', 'RMA kaydı için en az bir ürün listeye eklenmelidir.');
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  };

  const resetForm = () => {
    setCustomer(emptyCustomer);
    setSelectedCustomerKey(null);
    setCustomerQuery('');
    setShowCustomerResults(true);
    setProducts([]);
    setDraft(emptyProductDraft());
    setProductQuery('');
    setSelectedCatalogProductId(null);
    setShowProductResults(false);
    setStep(1);
  };

  const submit = async () => {
    if (submitting) return;
    if (!customer.customerName.trim()) {
      setStep(1);
      Alert.alert('Eksik müşteri', 'Müşteri adı olmadan RMA kaydı oluşturulamaz.');
      return;
    }
    if (products.length === 0) {
      setStep(2);
      Alert.alert('Eksik ürün', 'En az bir ürün ekleyin.');
      return;
    }

    setSubmitting(true);
    try {
      const ticket = await rmaApi.createTicket({
        customerName: customer.customerName.trim(),
        accountCode: customer.accountCode.trim() || undefined,
        phone: customer.phone.trim() || '-',
        email: customer.email.trim() || undefined,
        address: customer.address.trim() || undefined,
        products: products.map((product) => ({
          name: product.productName.trim(),
          brand: product.brand.trim() || undefined,
          model: product.model.trim() || undefined,
          serialNumber: product.serialNumber.trim() || undefined,
          stockCode: product.stockCode.trim() || undefined,
          category: product.category,
          description: product.description.trim() || undefined,
          quantity: Math.max(1, Number(product.quantity) || 1),
        })),
      });

      if (!ticket?.id) {
        throw new Error('Sunucu kayıt numarası döndürmedi.');
      }

      const createdProducts = Array.isArray(ticket.products) ? ticket.products : [];
      const uploadResults = await Promise.allSettled(
        products.map(async (product, index) => {
          const created = createdProducts[index];
          if (!product.imageUri || !created?.id) return;
          await uploadProductPhoto(ticket.id, created.id, product.imageUri);
        }),
      );

      const failedUploads = uploadResults.filter((result) => result.status === 'rejected').length;
      const ticketId = ticket.id;

      resetForm();
      void refreshCustomers().catch(() => undefined);

      if (failedUploads > 0) {
        Alert.alert(
          'RMA kaydı oluşturuldu',
          `Kayıt başarıyla oluşturuldu ancak ${failedUploads} ürün görseli yüklenemedi. Görseli kayıt detayından tekrar ekleyebilirsiniz.`,
          [{ text: 'Kayda Git', onPress: () => router.replace(recordHref(ticketId)) }],
        );
      } else {
        router.replace(recordHref(ticketId));
      }
    } catch (err) {
      Alert.alert('Kayıt oluşturulamadı', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <AppHeader title="Yeni RMA" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <StepIndicator currentStep={step} />

          {step === 1 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.sectionTitle}>Müşteri Seçimi</Text>
                  <Text style={styles.hint}>Cari listenizdeki kayıtları kod, ad, telefon veya e-posta ile arayın.</Text>
                </View>
                <Pressable
                  style={styles.listButton}
                  onPress={() => setShowCustomerResults((visible) => !visible)}
                >
                  <Ionicons name="people-outline" size={18} color={colors.primaryDark} />
                  <Text style={styles.listButtonText}>Kayıtlılar</Text>
                </Pressable>
              </View>

              <FormField
                label="Müşteri / Cari Ara"
                value={customerQuery}
                onFocus={() => setShowCustomerResults(true)}
                onChangeText={(value) => {
                  setCustomerQuery(value);
                  setShowCustomerResults(true);
                }}
                placeholder="Cari kodu, firma adı, telefon veya e-posta"
                autoCorrect={false}
              />

              {showCustomerResults ? (
                <View style={styles.searchResults}>
                  <View style={styles.searchResultsHeader}>
                    <Text style={styles.searchResultsTitle}>Kayıtlı Müşteriler</Text>
                    <Text style={styles.resultCount}>İlk {Math.min(customerOptions.length, 12)} sonuç</Text>
                  </View>

                  {catalogCustomersLoading ? <Text style={styles.hint}>Cari listesi aranıyor…</Text> : null}
                  {catalogCustomersError ? <Text style={styles.errorText}>{catalogCustomersError}</Text> : null}
                  {!catalogCustomersLoading && customerOptions.length === 0 ? (
                    <Text style={styles.hint}>Aramanızla eşleşen kayıt bulunamadı.</Text>
                  ) : null}

                  {customerOptions.map((item) => {
                    const active = selectedCustomerKey === item.key;
                    return (
                      <Pressable
                        key={item.key}
                        style={[styles.customerItem, active && styles.customerItemActive]}
                        onPress={() => selectCustomer(item)}
                      >
                        <View style={styles.optionHeader}>
                          <Text style={styles.customerName} numberOfLines={2}>{item.name}</Text>
                          <View style={[styles.sourceBadge, item.source === 'rma' && styles.sourceBadgeRma]}>
                            <Text style={styles.sourceBadgeText}>{item.source === 'catalog' ? 'CARİ' : 'RMA'}</Text>
                          </View>
                        </View>
                        {item.accountCode ? <Text style={styles.customerCode}>Cari Kodu: {item.accountCode}</Text> : null}
                        {item.phone ? <Text style={styles.customerMeta}>Telefon: {item.phone}</Text> : null}
                        {item.ticketCount ? <Text style={styles.customerMeta}>{item.ticketCount} önceki RMA kaydı</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {selectedCustomerKey ? (
                <View style={styles.selectedBanner}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <View style={styles.selectedBannerBody}>
                    <Text style={styles.selectedBannerTitle}>Kayıtlı müşteri seçildi</Text>
                    <Text style={styles.selectedBannerText} numberOfLines={2}>
                      {[customer.accountCode, customer.customerName].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </View>
              ) : null}

              <Text style={styles.dividerLabel}>Müşteri bilgileri</Text>
              <FormField
                label="Cari Kodu"
                value={customer.accountCode}
                onChangeText={(v) => updateCustomer('accountCode', v)}
                placeholder="Varsa cari kodu"
                autoCapitalize="characters"
              />
              <FormField
                label="Ad Soyad / Firma"
                value={customer.customerName}
                onChangeText={(v) => updateCustomer('customerName', v)}
              />
              <FormField
                label="Telefon"
                value={customer.phone}
                onChangeText={(v) => updateCustomer('phone', v)}
                keyboardType="phone-pad"
              />
              <FormField
                label="E-posta"
                value={customer.email}
                onChangeText={(v) => updateCustomer('email', v)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <FormField
                label="Adres"
                value={customer.address}
                onChangeText={(v) => updateCustomer('address', v)}
                multiline
              />
              <Text style={styles.hint}>
                Cari listesinden seçilen müşteri RMA kaydına cari koduyla bağlanır. Telefon ve diğer iletişim bilgileri gerekirse bu ekrandan tamamlanabilir.
              </Text>
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.sectionTitle}>Ürün Seçimi</Text>
                  <Text style={styles.hint}>Kayıtlı ürün listenizde stok kodu veya ürün adıyla arama yapın.</Text>
                </View>
                <Pressable
                  style={styles.listButton}
                  onPress={() => setShowProductResults((visible) => !visible)}
                >
                  <Ionicons name="cube-outline" size={18} color={colors.primaryDark} />
                  <Text style={styles.listButtonText}>Kayıtlılar</Text>
                </Pressable>
              </View>

              <FormField
                label="Ürün Ara"
                value={productQuery}
                onFocus={() => setShowProductResults(true)}
                onChangeText={(value) => {
                  setProductQuery(value);
                  setShowProductResults(true);
                }}
                placeholder="Stok kodu veya ürün adı"
                autoCorrect={false}
              />

              {showProductResults ? (
                <View style={styles.searchResults}>
                  <View style={styles.searchResultsHeader}>
                    <Text style={styles.searchResultsTitle}>Kayıtlı Ürünler</Text>
                    <Text style={styles.resultCount}>İlk {Math.min(catalogProducts.length, 12)} sonuç</Text>
                  </View>
                  {catalogProductsLoading ? <Text style={styles.hint}>Ürün listesi aranıyor…</Text> : null}
                  {catalogProductsError ? <Text style={styles.errorText}>{catalogProductsError}</Text> : null}
                  {!catalogProductsLoading && catalogProducts.length === 0 ? (
                    <Text style={styles.hint}>Aramanızla eşleşen ürün bulunamadı.</Text>
                  ) : null}

                  {catalogProducts.slice(0, 12).map((item) => {
                    const active = selectedCatalogProductId === item.id;
                    return (
                      <Pressable
                        key={item.id}
                        style={[styles.catalogItem, active && styles.catalogItemActive]}
                        onPress={() => selectCatalogProduct(item)}
                      >
                        <Text style={styles.catalogCode}>{item.stockCode}</Text>
                        <Text style={styles.catalogName} numberOfLines={2}>{item.stockName}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {selectedCatalogProductId ? (
                <View style={styles.selectedBanner}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <View style={styles.selectedBannerBody}>
                    <Text style={styles.selectedBannerTitle}>Kayıtlı ürün seçildi</Text>
                    <Text style={styles.selectedBannerText} numberOfLines={2}>
                      {[draft.stockCode, draft.productName].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </View>
              ) : null}

              <FormField
                label="Stok Kodu"
                value={draft.stockCode}
                onChangeText={(v) => updateDraft('stockCode', v)}
                placeholder="Listeden seçimde otomatik dolar"
                autoCapitalize="characters"
              />
              <FormField
                label="Ürün Adı"
                value={draft.productName}
                onChangeText={(v) => updateDraft('productName', v)}
                placeholder="Listeden seçimde otomatik dolar"
              />
              <FormField label="Marka" value={draft.brand} onChangeText={(v) => updateDraft('brand', v)} />
              <FormField label="Model" value={draft.model} onChangeText={(v) => updateDraft('model', v)} />
              <FormField
                label="Seri No"
                value={draft.serialNumber}
                onChangeText={(v) => updateDraft('serialNumber', v)}
                rightSlot={
                  <Pressable style={styles.scanButton} disabled>
                    <Ionicons name="barcode-outline" size={20} color={colors.textMuted} />
                  </Pressable>
                }
              />
              <FormField
                label="Miktar"
                value={draft.quantity}
                onChangeText={(v) => updateDraft('quantity', v)}
                keyboardType="number-pad"
              />

              <Text style={styles.sectionTitle}>İşlem Türü</Text>
              <View style={styles.categoryGrid}>
                {CATEGORY_OPTIONS.map((option) => {
                  const active = draft.category === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      style={[styles.categoryCard, active && styles.categoryCardActive]}
                      onPress={() => updateDraft('category', option.value)}
                    >
                      <Text style={[styles.categoryTitle, active && styles.categoryTitleActive]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <FormField
                label="Açıklama / Müşteri Şikayeti"
                value={draft.description}
                onChangeText={(v) => updateDraft('description', v)}
                multiline
              />

              <ProductImagePicker imageUri={draft.imageUri} onChange={(uri) => updateDraft('imageUri', uri)} />

              <Pressable style={styles.addButton} onPress={addProduct}>
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.addButtonText}>Ürünü RMA Listesine Ekle</Text>
              </Pressable>

              <View style={styles.addedList}>
                <Text style={styles.sectionTitle}>Eklenen Ürünler ({products.length})</Text>
                {products.length === 0 ? (
                  <Text style={styles.hint}>En az bir ürün ekleyin.</Text>
                ) : (
                  products.map((product, index) => (
                    <Card key={product.id} style={styles.addedCard}>
                      <View style={styles.addedRow}>
                        <ProductImagePicker
                          compact
                          imageUri={product.imageUri}
                          onChange={(uri) => updateProductImage(product.id, uri)}
                        />
                        <View style={styles.addedBody}>
                          <View style={styles.addedHeader}>
                            <Text style={styles.addedTitle}>
                              {index + 1}. {product.productName}
                            </Text>
                            <Pressable style={styles.deleteButton} onPress={() => removeProduct(product.id)}>
                              <Ionicons name="trash-outline" size={18} color={colors.danger} />
                            </Pressable>
                          </View>
                          <Text style={styles.addedMeta}>
                            {product.stockCode ? `${product.stockCode} · ` : ''}
                            {getCategoryLabel(product.category)} · Adet: {product.quantity} · Seri: {product.serialNumber || '-'}
                          </Text>
                        </View>
                      </View>
                    </Card>
                  ))
                )}
              </View>
            </View>
          ) : null}

          {step === 3 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Kayıt Özeti</Text>
              <Card style={styles.summaryCard}>
                <SummaryRow label="Cari Kodu" value={customer.accountCode || '-'} />
                <SummaryRow label="Müşteri" value={customer.customerName || '-'} />
                <SummaryRow label="Telefon" value={customer.phone || '-'} />
                <SummaryRow label="E-posta" value={customer.email || '-'} />
                <SummaryRow label="Ürün sayısı" value={String(products.length)} />
              </Card>

              {products.map((product, index) => (
                <Card key={product.id} style={styles.summaryCard}>
                  <View style={styles.summaryProductHeader}>
                    <View style={styles.summaryProductText}>
                      <Text style={styles.productSummaryTitle}>Ürün {index + 1}</Text>
                      <Text style={styles.addedMeta}>{product.productName}</Text>
                    </View>
                    {product.imageUri ? (
                      <ProductImagePicker
                        compact
                        imageUri={product.imageUri}
                        onChange={(uri) => updateProductImage(product.id, uri)}
                      />
                    ) : null}
                  </View>
                  <SummaryRow label="Stok Kodu" value={product.stockCode || '-'} />
                  <SummaryRow label="Ad" value={product.productName} />
                  <SummaryRow label="Marka / Model" value={[product.brand, product.model].filter(Boolean).join(' ') || '-'} />
                  <SummaryRow label="Seri No" value={product.serialNumber || '-'} />
                  <SummaryRow label="Miktar" value={product.quantity} />
                  <SummaryRow label="İşlem" value={getCategoryLabel(product.category)} />
                  <SummaryRow label="Açıklama" value={product.description || '-'} />
                </Card>
              ))}

              <View style={styles.submitInfo}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.primaryDark} />
                <Text style={styles.submitInfoText}>
                  Önce RMA kaydı oluşturulur. Fotoğraf yüklemesinde sorun olsa bile oluşturulan RMA kaydı korunur.
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {step > 1 ? (
            <Pressable
              style={styles.secondaryButton}
              disabled={submitting}
              onPress={() => setStep((current) => Math.max(1, current - 1))}
            >
              <Text style={styles.secondaryText}>Geri</Text>
            </Pressable>
          ) : (
            <View style={styles.placeholder} />
          )}

          {step < 3 ? (
            <Pressable
              style={[styles.primaryButton, !canContinue() && styles.buttonDisabled]}
              disabled={!canContinue()}
              onPress={goNext}
            >
              <Text style={styles.primaryText}>Devam</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.primaryButton, submitting && styles.buttonDisabled]}
              disabled={submitting}
              onPress={submit}
            >
              <Text style={styles.primaryText}>{submitting ? 'Oluşturuluyor…' : 'RMA Kaydını Oluştur'}</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  section: {
    gap: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  sectionHeaderText: {
    flex: 1,
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  listButton: {
    minHeight: minTouchTarget,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  listButtonText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  searchResults: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  searchResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  searchResultsTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  resultCount: {
    ...typography.caption,
    color: colors.textMuted,
  },
  catalogItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  catalogItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  catalogCode: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  catalogName: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  customerItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  customerItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  customerName: {
    ...typography.bodyMedium,
    color: colors.text,
    flex: 1,
  },
  customerCode: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  customerMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sourceBadge: {
    borderRadius: radius.full,
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  sourceBadgeRma: {
    backgroundColor: colors.purpleSoft,
  },
  sourceBadgeText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  selectedBanner: {
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.md,
    backgroundColor: colors.successSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  selectedBannerBody: {
    flex: 1,
    gap: 2,
  },
  selectedBannerTitle: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '700',
  },
  selectedBannerText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  dividerLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
  scanButton: {
    position: 'absolute',
    right: spacing.md,
    top: 12,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  categoryCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  categoryTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  categoryTitleActive: {
    color: colors.primaryDark,
  },
  addButton: {
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  addButtonText: {
    ...typography.bodyMedium,
    color: colors.primaryDark,
  },
  addedList: {
    gap: spacing.md,
  },
  addedCard: {
    gap: spacing.xs,
  },
  addedRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  addedBody: {
    flex: 1,
    gap: spacing.xs,
  },
  addedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  addedTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    flex: 1,
  },
  addedMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    gap: spacing.md,
  },
  summaryProductHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  summaryProductText: {
    flex: 1,
    gap: spacing.xs,
  },
  productSummaryTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  summaryRow: {
    gap: 2,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  summaryValue: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  submitInfo: {
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
  },
  submitInfoText: {
    ...typography.caption,
    color: colors.primaryDark,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  placeholder: {
    flex: 1,
  },
  primaryButton: {
    flex: 1,
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  secondaryButton: {
    flex: 1,
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  primaryText: {
    ...typography.bodyMedium,
    color: colors.surface,
    textAlign: 'center',
  },
  secondaryText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
