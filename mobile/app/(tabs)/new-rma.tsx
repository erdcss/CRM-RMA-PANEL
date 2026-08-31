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
import { SupplierPickerModal } from '@/components/suppliers/SupplierPickerModal';
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
  supplierAccountCode: string;
  supplierName: string;
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
  supplierAccountCode: '',
  supplierName: '',
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
  const [supplierTargetId, setSupplierTargetId] = useState<string | 'draft' | null>(null);

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
    if (key === 'stockCode' || key === 'productName') setSelectedCatalogProductId(null);
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

  const assignSupplier = (supplier: CatalogCustomer) => {
    if (supplierTargetId === 'draft') {
      setDraft((prev) => ({
        ...prev,
        supplierAccountCode: supplier.accountCode,
        supplierName: supplier.accountName,
      }));
      return;
    }

    if (supplierTargetId) {
      setProducts((prev) =>
        prev.map((product) =>
          product.id === supplierTargetId
            ? {
                ...product,
                supplierAccountCode: supplier.accountCode,
                supplierName: supplier.accountName,
              }
            : product,
        ),
      );
    }
  };

  const removeSupplier = (productId: string | 'draft') => {
    if (productId === 'draft') {
      setDraft((prev) => ({ ...prev, supplierAccountCode: '', supplierName: '' }));
      return;
    }
    setProducts((prev) =>
      prev.map((product) =>
        product.id === productId ? { ...product, supplierAccountCode: '', supplierName: '' } : product,
      ),
    );
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
    setSupplierTargetId(null);
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

      if (!ticket?.id) throw new Error('Sunucu kayıt numarası döndürmedi.');

      const createdProducts = Array.isArray(ticket.products)
        ? [...ticket.products].sort((a, b) => a.id - b.id)
        : [];

      const uploadResults = await Promise.allSettled(
        products.map(async (product, index) => {
          if (!product.imageUri) return;
          const created = createdProducts[index];
          if (!created?.id) throw new Error('Görsel için oluşturulan ürün bulunamadı.');
          await uploadProductPhoto(ticket.id, created.id, product.imageUri);
        }),
      );

      const supplierResults = await Promise.allSettled(
        products.map(async (product, index) => {
          if (!product.supplierAccountCode || !product.supplierName) return;
          const created = createdProducts[index];
          if (!created?.id) throw new Error('Tedarikçi için oluşturulan ürün bulunamadı.');
          await rmaApi.addSupplierItem({
            productId: created.id,
            supplierAccountCode: product.supplierAccountCode,
            supplierName: product.supplierName,
          });
        }),
      );

      const failedUploads = uploadResults.filter((result) => result.status === 'rejected');
      const failedSuppliers = supplierResults.filter((result) => result.status === 'rejected').length;
      const ticketId = ticket.id;

      resetForm();
      void refreshCustomers().catch(() => undefined);

      if (failedUploads.length > 0 || failedSuppliers > 0) {
        const firstUploadError = failedUploads[0]?.status === 'rejected' && failedUploads[0].reason instanceof Error
          ? failedUploads[0].reason.message
          : null;
        const parts = [
          failedUploads.length > 0 ? `${failedUploads.length} görsel` : null,
          failedSuppliers > 0 ? `${failedSuppliers} tedarikçi bağlantısı` : null,
        ].filter(Boolean);
        Alert.alert(
          'RMA kaydı oluşturuldu',
          `RMA kaydı başarıyla oluşturuldu. Ancak ${parts.join(' ve ')} tamamlanamadı; kayıt detayından veya Tedarikçiler sayfasından tekrar ekleyebilirsiniz.${firstUploadError ? `\n\n${firstUploadError}` : ''}`,
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

  const selectedSupplierCode =
    supplierTargetId === 'draft'
      ? draft.supplierAccountCode
      : products.find((product) => product.id === supplierTargetId)?.supplierAccountCode;

  return (
    <Screen edges={['top', 'bottom']}>
      <AppHeader title="Yeni RMA" subtitle="Müşteri · Ürün · Tedarikçi" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <StepIndicator currentStep={step} />

          {step === 1 ? (
            <View style={styles.section}>
              <StepHero
                icon="person-add-outline"
                eyebrow="1. ADIM"
                title="Müşteri / Cari Seç"
                description="Kayıtlı cari listenizden seçim yapın; RMA kaydı bu müşteriyle izlenir."
              />

              <Card style={styles.panel}>
                <View style={styles.panelHeader}>
                  <View style={styles.panelTitleBody}>
                    <Text style={styles.panelTitle}>Cari Arama</Text>
                    <Text style={styles.hint}>Cari kodu, firma adı, telefon veya e-posta ile arayın.</Text>
                  </View>
                  <Pressable style={styles.softButton} onPress={() => setShowCustomerResults((visible) => !visible)}>
                    <Ionicons name="people-outline" size={17} color={colors.primaryDark} />
                    <Text style={styles.softButtonText}>Kayıtlılar</Text>
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
                  placeholder="Cari kodu veya firma adı"
                  autoCorrect={false}
                />

                {showCustomerResults ? (
                  <View style={styles.searchResults}>
                    <View style={styles.resultHeader}>
                      <Text style={styles.resultTitle}>Eşleşen Cariler</Text>
                      <Text style={styles.resultCount}>{Math.min(customerOptions.length, 12)} sonuç</Text>
                    </View>
                    {catalogCustomersLoading ? <Text style={styles.hint}>Cari listesi aranıyor…</Text> : null}
                    {catalogCustomersError ? <Text style={styles.errorText}>{catalogCustomersError}</Text> : null}
                    {!catalogCustomersLoading && customerOptions.length === 0 ? (
                      <Text style={styles.hint}>Eşleşen kayıt bulunamadı.</Text>
                    ) : null}
                    {customerOptions.map((item) => {
                      const active = selectedCustomerKey === item.key;
                      return (
                        <Pressable
                          key={item.key}
                          style={[styles.optionCard, active && styles.optionCardActive]}
                          onPress={() => selectCustomer(item)}
                        >
                          <View style={styles.optionIcon}>
                            <Ionicons name="business-outline" size={18} color={colors.primaryDark} />
                          </View>
                          <View style={styles.optionBody}>
                            <Text style={styles.optionTitle}>{item.name}</Text>
                            <Text style={styles.optionMeta}>
                              {[item.accountCode ? `Cari: ${item.accountCode}` : null, item.phone].filter(Boolean).join(' · ') || 'Cari bilgisi'}
                            </Text>
                          </View>
                          {active ? <Ionicons name="checkmark-circle" size={20} color={colors.success} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </Card>

              <Card style={styles.panel}>
                <View style={styles.panelHeaderSimple}>
                  <Ionicons name="id-card-outline" size={20} color={colors.primaryDark} />
                  <Text style={styles.panelTitle}>Müşteri Bilgileri</Text>
                </View>
                <FormField
                  label="Cari Kodu"
                  value={customer.accountCode}
                  onChangeText={(value) => updateCustomer('accountCode', value)}
                  placeholder="Varsa cari kodu"
                  autoCapitalize="characters"
                />
                <FormField label="Ad Soyad / Firma" value={customer.customerName} onChangeText={(value) => updateCustomer('customerName', value)} />
                <FormField label="Telefon" value={customer.phone} onChangeText={(value) => updateCustomer('phone', value)} keyboardType="phone-pad" />
                <FormField label="E-posta" value={customer.email} onChangeText={(value) => updateCustomer('email', value)} keyboardType="email-address" autoCapitalize="none" />
                <FormField label="Adres" value={customer.address} onChangeText={(value) => updateCustomer('address', value)} multiline />
              </Card>
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.section}>
              <StepHero
                icon="cube-outline"
                eyebrow="2. ADIM"
                title="Ürünleri Oluştur"
                description="Her ürünü ayrı işlem, görsel ve tedarikçi bağlantısıyla kaydedin."
              />

              <Card style={styles.panel}>
                <View style={styles.panelHeader}>
                  <View style={styles.panelTitleBody}>
                    <Text style={styles.panelTitle}>Kayıtlı Ürün Ara</Text>
                    <Text style={styles.hint}>Stok kodu veya ürün adına göre canlı katalogda arayın.</Text>
                  </View>
                  <Pressable style={styles.softButton} onPress={() => setShowProductResults((visible) => !visible)}>
                    <Ionicons name="list-outline" size={17} color={colors.primaryDark} />
                    <Text style={styles.softButtonText}>Liste</Text>
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
                    <View style={styles.resultHeader}>
                      <Text style={styles.resultTitle}>Kayıtlı Ürünler</Text>
                      <Text style={styles.resultCount}>{Math.min(catalogProducts.length, 12)} sonuç</Text>
                    </View>
                    {catalogProductsLoading ? <Text style={styles.hint}>Ürün listesi aranıyor…</Text> : null}
                    {catalogProductsError ? <Text style={styles.errorText}>{catalogProductsError}</Text> : null}
                    {catalogProducts.slice(0, 12).map((item) => (
                      <Pressable
                        key={item.id}
                        style={[styles.optionCard, selectedCatalogProductId === item.id && styles.optionCardActive]}
                        onPress={() => selectCatalogProduct(item)}
                      >
                        <View style={styles.optionIcon}>
                          <Ionicons name="cube-outline" size={18} color={colors.primaryDark} />
                        </View>
                        <View style={styles.optionBody}>
                          <Text style={styles.optionTitle}>{item.stockName}</Text>
                          <Text style={styles.optionMeta}>{item.stockCode}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </Card>

              <Card style={styles.panel}>
                <View style={styles.panelHeaderSimple}>
                  <Ionicons name="construct-outline" size={20} color={colors.primaryDark} />
                  <Text style={styles.panelTitle}>Ürün Kartı</Text>
                </View>

                <FormField label="Stok Kodu" value={draft.stockCode} onChangeText={(value) => updateDraft('stockCode', value)} placeholder="Stok kodu" autoCapitalize="characters" />
                <FormField label="Ürün Adı" value={draft.productName} onChangeText={(value) => updateDraft('productName', value)} placeholder="Ürün adı" />
                <View style={styles.twoColumn}>
                  <View style={styles.column}><FormField label="Marka" value={draft.brand} onChangeText={(value) => updateDraft('brand', value)} /></View>
                  <View style={styles.column}><FormField label="Model" value={draft.model} onChangeText={(value) => updateDraft('model', value)} /></View>
                </View>
                <View style={styles.twoColumn}>
                  <View style={styles.column}><FormField label="Seri No" value={draft.serialNumber} onChangeText={(value) => updateDraft('serialNumber', value)} /></View>
                  <View style={styles.quantityColumn}><FormField label="Adet" value={draft.quantity} onChangeText={(value) => updateDraft('quantity', value)} keyboardType="number-pad" /></View>
                </View>

                <Text style={styles.fieldLabel}>İşlem Türü</Text>
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

                <FormField label="Açıklama / Müşteri Şikayeti" value={draft.description} onChangeText={(value) => updateDraft('description', value)} multiline />

                <ProductImagePicker imageUri={draft.imageUri} onChange={(uri) => updateDraft('imageUri', uri)} />

                <SupplierButton
                  supplierName={draft.supplierName}
                  supplierCode={draft.supplierAccountCode}
                  onPress={() => setSupplierTargetId('draft')}
                  onClear={draft.supplierName ? () => removeSupplier('draft') : undefined}
                />

                <Pressable style={styles.addProductButton} onPress={addProduct}>
                  <Ionicons name="add-circle" size={21} color={colors.surface} />
                  <Text style={styles.addProductText}>Ürünü RMA Listesine Ekle</Text>
                </Pressable>
              </Card>

              <View style={styles.addedSection}>
                <View style={styles.addedSectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>RMA Ürünleri</Text>
                    <Text style={styles.hint}>{products.length} ürün eklendi</Text>
                  </View>
                  <View style={styles.countBadge}><Text style={styles.countBadgeText}>{products.length}</Text></View>
                </View>

                {products.length === 0 ? (
                  <Card style={styles.emptyProductCard}>
                    <Ionicons name="cube-outline" size={28} color={colors.textMuted} />
                    <Text style={styles.hint}>Henüz ürün eklenmedi.</Text>
                  </Card>
                ) : (
                  products.map((product, index) => (
                    <Card key={product.id} style={styles.addedCard}>
                      <View style={styles.addedRow}>
                        <ProductImagePicker compact imageUri={product.imageUri} onChange={(uri) => updateProductImage(product.id, uri)} />
                        <View style={styles.addedBody}>
                          <View style={styles.addedHeader}>
                            <View style={styles.addedTitleBody}>
                              <Text style={styles.addedIndex}>ÜRÜN {index + 1}</Text>
                              <Text style={styles.addedTitle}>{product.productName}</Text>
                            </View>
                            <Pressable style={styles.deleteButton} onPress={() => removeProduct(product.id)}>
                              <Ionicons name="trash-outline" size={17} color={colors.danger} />
                            </Pressable>
                          </View>
                          <Text style={styles.addedMeta}>
                            {[product.stockCode, getCategoryLabel(product.category), `${product.quantity} adet`].filter(Boolean).join(' · ')}
                          </Text>
                          <SupplierButton
                            compact
                            supplierName={product.supplierName}
                            supplierCode={product.supplierAccountCode}
                            onPress={() => setSupplierTargetId(product.id)}
                            onClear={product.supplierName ? () => removeSupplier(product.id) : undefined}
                          />
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
              <StepHero
                icon="checkmark-done-outline"
                eyebrow="3. ADIM"
                title="Kontrol ve Kaydet"
                description="Müşteri, ürün ve tedarikçi yönlendirmelerini son kez kontrol edin."
              />

              <Card style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Müşteri</Text>
                <SummaryRow label="Cari Kodu" value={customer.accountCode || '-'} />
                <SummaryRow label="Müşteri" value={customer.customerName || '-'} />
                <SummaryRow label="Telefon" value={customer.phone || '-'} />
                <SummaryRow label="Ürün sayısı" value={String(products.length)} />
              </Card>

              {products.map((product, index) => (
                <Card key={product.id} style={styles.summaryCard}>
                  <View style={styles.summaryProductHeader}>
                    <View style={styles.summaryProductText}>
                      <Text style={styles.addedIndex}>ÜRÜN {index + 1}</Text>
                      <Text style={styles.summaryTitle}>{product.productName}</Text>
                    </View>
                    {product.imageUri ? <ProductImagePicker compact imageUri={product.imageUri} onChange={(uri) => updateProductImage(product.id, uri)} /> : null}
                  </View>
                  <SummaryRow label="Stok Kodu" value={product.stockCode || '-'} />
                  <SummaryRow label="Seri No" value={product.serialNumber || '-'} />
                  <SummaryRow label="Adet" value={product.quantity} />
                  <SummaryRow label="İşlem" value={getCategoryLabel(product.category)} />
                  <SummaryRow label="Tedarikçi" value={product.supplierName ? `${product.supplierAccountCode} · ${product.supplierName}` : 'Atanmadı'} />
                  <SummaryRow label="Açıklama" value={product.description || '-'} />
                </Card>
              ))}

              <View style={styles.syncInfo}>
                <Ionicons name="git-merge-outline" size={22} color={colors.primaryDark} />
                <View style={styles.syncInfoBody}>
                  <Text style={styles.syncInfoTitle}>Tek ürün, tek durum kaynağı</Text>
                  <Text style={styles.syncInfoText}>
                    Tedarikçi sayfasında yapılan durum değişikliği aynı RMA ürününü günceller; müşterinin kayıt ekranında da otomatik olarak aynı durum görünür.
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {step > 1 ? (
            <Pressable style={styles.secondaryButton} disabled={submitting} onPress={() => setStep((current) => Math.max(1, current - 1))}>
              <Ionicons name="chevron-back" size={18} color={colors.text} />
              <Text style={styles.secondaryText}>Geri</Text>
            </Pressable>
          ) : <View style={styles.placeholder} />}

          {step < 3 ? (
            <Pressable style={[styles.primaryButton, !canContinue() && styles.buttonDisabled]} disabled={!canContinue()} onPress={goNext}>
              <Text style={styles.primaryText}>Devam</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.surface} />
            </Pressable>
          ) : (
            <Pressable style={[styles.primaryButton, submitting && styles.buttonDisabled]} disabled={submitting} onPress={submit}>
              <Ionicons name="checkmark-circle-outline" size={19} color={colors.surface} />
              <Text style={styles.primaryText}>{submitting ? 'Oluşturuluyor…' : 'RMA Kaydını Oluştur'}</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      <SupplierPickerModal
        visible={supplierTargetId !== null}
        selectedAccountCode={selectedSupplierCode}
        onClose={() => setSupplierTargetId(null)}
        onSelect={assignSupplier}
      />
    </Screen>
  );
}

function StepHero({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.stepHero}>
      <View style={styles.stepHeroIcon}><Ionicons name={icon} size={24} color={colors.primaryDark} /></View>
      <View style={styles.stepHeroBody}>
        <Text style={styles.stepEyebrow}>{eyebrow}</Text>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDescription}>{description}</Text>
      </View>
    </View>
  );
}

function SupplierButton({
  supplierName,
  supplierCode,
  onPress,
  onClear,
  compact,
}: {
  supplierName: string;
  supplierCode: string;
  onPress: () => void;
  onClear?: () => void;
  compact?: boolean;
}) {
  const assigned = Boolean(supplierName);
  return (
    <View style={[styles.supplierRow, compact && styles.supplierRowCompact]}>
      <Pressable style={[styles.supplierButton, assigned && styles.supplierButtonAssigned]} onPress={onPress}>
        <View style={styles.supplierIcon}>
          <Ionicons name="business-outline" size={18} color={assigned ? colors.success : colors.primaryDark} />
        </View>
        <View style={styles.supplierBody}>
          <Text style={styles.supplierLabel}>{assigned ? 'Tedarikçi Firma' : 'Tedarikçi Firma Ekle'}</Text>
          <Text style={styles.supplierValue} numberOfLines={2}>
            {assigned ? `${supplierCode} · ${supplierName}` : 'Cari listesinden tedarikçi seç'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
      </Pressable>
      {onClear ? (
        <Pressable style={styles.clearSupplierButton} onPress={onClear}>
          <Ionicons name="close" size={18} color={colors.danger} />
        </Pressable>
      ) : null}
    </View>
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
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  section: { gap: spacing.lg },
  stepHero: {
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepHeroIcon: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepHeroBody: { flex: 1, gap: 3 },
  stepEyebrow: { fontSize: 10, lineHeight: 13, fontWeight: '800', color: colors.primaryDark, letterSpacing: 0.8 },
  stepTitle: { ...typography.title, color: colors.text },
  stepDescription: { ...typography.caption, color: colors.textSecondary },
  panel: { gap: spacing.lg, padding: spacing.lg },
  panelHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  panelHeaderSimple: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  panelTitleBody: { flex: 1, gap: 2 },
  panelTitle: { ...typography.subtitle, color: colors.text },
  sectionTitle: { ...typography.subtitle, color: colors.text },
  hint: { ...typography.caption, color: colors.textSecondary },
  errorText: { ...typography.caption, color: colors.danger },
  softButton: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  softButtonText: { ...typography.caption, color: colors.primaryDark, fontWeight: '700' },
  searchResults: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xs },
  resultTitle: { ...typography.bodyMedium, color: colors.text },
  resultCount: { ...typography.caption, color: colors.textMuted },
  optionCard: {
    minHeight: 62,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionCardActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBody: { flex: 1, gap: 2 },
  optionTitle: { ...typography.bodyMedium, color: colors.text },
  optionMeta: { ...typography.caption, color: colors.textSecondary },
  twoColumn: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  column: { flex: 1 },
  quantityColumn: { width: 92 },
  fieldLabel: { ...typography.bodyMedium, color: colors.text },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryCard: {
    flex: 1,
    minWidth: '29%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  categoryCardActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  categoryTitle: { ...typography.bodyMedium, color: colors.text },
  categoryTitleActive: { color: colors.primaryDark },
  supplierRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  supplierRowCompact: { marginTop: spacing.sm },
  supplierButton: {
    flex: 1,
    minHeight: 62,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  supplierButtonAssigned: { borderColor: colors.success, backgroundColor: colors.successSoft },
  supplierIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supplierBody: { flex: 1, gap: 1 },
  supplierLabel: { fontSize: 10, lineHeight: 13, fontWeight: '800', color: colors.textSecondary },
  supplierValue: { ...typography.caption, color: colors.text, fontWeight: '600' },
  clearSupplierButton: {
    width: minTouchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addProductButton: {
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  addProductText: { ...typography.bodyMedium, color: colors.surface, fontWeight: '700' },
  addedSection: { gap: spacing.md },
  addedSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  countBadgeText: { ...typography.bodyMedium, color: colors.surface, fontWeight: '800' },
  emptyProductCard: { minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  addedCard: { gap: spacing.sm, padding: spacing.md },
  addedRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  addedBody: { flex: 1, gap: spacing.xs },
  addedHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  addedTitleBody: { flex: 1, gap: 1 },
  addedIndex: { fontSize: 10, lineHeight: 13, fontWeight: '800', color: colors.primaryDark, letterSpacing: 0.5 },
  addedTitle: { ...typography.bodyMedium, color: colors.text },
  addedMeta: { ...typography.caption, color: colors.textSecondary },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: { gap: spacing.md, padding: spacing.lg },
  summaryProductHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  summaryProductText: { flex: 1, gap: 2 },
  summaryTitle: { ...typography.subtitle, color: colors.text },
  summaryRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  summaryLabel: { ...typography.caption, color: colors.textMuted, width: 92 },
  summaryValue: { ...typography.bodyMedium, color: colors.text, flex: 1 },
  syncInfo: {
    borderRadius: radius.lg,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.success,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  syncInfoBody: { flex: 1, gap: spacing.xs },
  syncInfoTitle: { ...typography.bodyMedium, color: colors.success, fontWeight: '800' },
  syncInfoText: { ...typography.caption, color: colors.textSecondary },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  placeholder: { flex: 1 },
  primaryButton: {
    flex: 1,
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  secondaryButton: {
    flex: 1,
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  primaryText: { ...typography.bodyMedium, color: colors.surface, textAlign: 'center' },
  secondaryText: { ...typography.bodyMedium, color: colors.text },
  buttonDisabled: { opacity: 0.6 },
});
