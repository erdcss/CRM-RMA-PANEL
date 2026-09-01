import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View} from 'react-native';
import { appAlert } from '@/lib/appAlert';
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
import { colors, radius, spacing, typography } from '@/constants/theme';
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
  imageUri: null});

const emptyCustomer: CustomerForm = {
  customerName: '',
  accountCode: '',
  phone: '',
  email: '',
  address: ''};

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
    address: ''};
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
    ticketCount: item.ticketCount};
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
    error: catalogCustomersError} = useCatalogCustomers(debouncedCustomerQuery);

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
    error: catalogProductsError} = useCatalogProducts(debouncedProductQuery);

  const [submitting, setSubmitting] = useState(false);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);

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
      address: item.address});
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
      productName: item.stockName}));
    setProductQuery(`${item.stockCode} · ${item.stockName}`);
    setShowProductResults(false);
  };

  const assignSupplier = (supplier: CatalogCustomer) => {
    if (supplierTargetId === 'draft') {
      setDraft((prev) => ({
        ...prev,
        supplierAccountCode: supplier.accountCode,
        supplierName: supplier.accountName}));
      return;
    }

    if (supplierTargetId) {
      setProducts((prev) =>
        prev.map((product) =>
          product.id === supplierTargetId
            ? {
                ...product,
                supplierAccountCode: supplier.accountCode,
                supplierName: supplier.accountName}
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
      appAlert('Eksik bilgi', 'Listeden bir ürün seçin veya ürün adını girin.');
      return;
    }

    const quantity = Number(draft.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) {
      appAlert('Geçersiz miktar', 'Miktar en az 1 olmalıdır.');
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
      appAlert('Müşteri seçin', 'Kayıtlı cari listesinden müşteri seçin veya müşteri adını girin.');
      return;
    }
    if (step === 2 && products.length === 0) {
      appAlert('Ürün ekleyin', 'RMA kaydı için en az bir ürün listeye eklenmelidir.');
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
      appAlert('Eksik müşteri', 'Müşteri adı olmadan RMA kaydı oluşturulamaz.');
      return;
    }
    if (products.length === 0) {
      setStep(2);
      appAlert('Eksik ürün', 'En az bir ürün ekleyin.');
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
          quantity: Math.max(1, Number(product.quantity) || 1)}))});

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
            supplierName: product.supplierName});
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
        appAlert(
          'RMA kaydı oluşturuldu',
          `RMA kaydı başarıyla oluşturuldu. Ancak ${parts.join(' ve ')} tamamlanamadı; kayıt detayından veya Tedarikçiler sayfasından tekrar ekleyebilirsiniz.${firstUploadError ? `\n\n${firstUploadError}` : ''}`,
          [{ text: 'Kayda Git', onPress: () => router.replace(recordHref(ticketId)) }],
        );
      } else {
        router.replace(recordHref(ticketId));
      }
    } catch (err) {
      appAlert('Kayıt oluşturulamadı', err instanceof Error ? err.message : 'Bilinmeyen hata');
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
      <AppHeader title="Yeni RMA" subtitle={`Adım ${step}/3`} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <StepIndicator currentStep={step} />

          {step === 1 ? (
            <View style={styles.section}>
              <StepCaption title="Müşteri / Cari" />

              <Card style={styles.panel}>
                <View style={styles.panelHeader}>
                  <Text style={styles.panelTitle}>Cari Ara</Text>
                  <Pressable style={styles.softButton} onPress={() => setShowCustomerResults((visible) => !visible)}>
                    <Ionicons name="people-outline" size={15} color={colors.primaryDark} />
                    <Text style={styles.softButtonText}>Liste</Text>
                  </Pressable>
                </View>

                <FormField
                  compact
                  label="Müşteri / Cari"
                  value={customerQuery}
                  onFocus={() => setShowCustomerResults(true)}
                  onChangeText={(value) => {
                    setCustomerQuery(value);
                    setShowCustomerResults(true);
                  }}
                  placeholder="Cari kodu veya firma adı"
                  autoCorrect={false}
                />

                {showCustomerResults && customerOptions.length > 0 ? (
                  <View style={styles.searchResults}>
                    {catalogCustomersLoading ? <Text style={styles.hint}>Aranıyor…</Text> : null}
                    {catalogCustomersError ? <Text style={styles.errorText}>{catalogCustomersError}</Text> : null}
                    {customerOptions.map((item) => {
                      const active = selectedCustomerKey === item.key;
                      return (
                        <Pressable
                          key={item.key}
                          style={[styles.optionCard, active && styles.optionCardActive]}
                          onPress={() => selectCustomer(item)}
                        >
                          <View style={styles.optionBody}>
                            <Text style={styles.optionTitle} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.optionMeta} numberOfLines={1}>
                              {[item.accountCode ? `Cari: ${item.accountCode}` : null, item.phone].filter(Boolean).join(' · ') || 'Cari bilgisi'}
                            </Text>
                          </View>
                          {active ? <Ionicons name="checkmark-circle" size={18} color={colors.success} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}

                <FormField compact label="Cari Kodu" value={customer.accountCode} onChangeText={(value) => updateCustomer('accountCode', value)} placeholder="Varsa cari kodu" autoCapitalize="characters" />
                <FormField compact label="Ad Soyad / Firma" value={customer.customerName} onChangeText={(value) => updateCustomer('customerName', value)} />

                <Pressable style={styles.collapseToggle} onPress={() => setShowCustomerDetails((v) => !v)}>
                  <Ionicons name={showCustomerDetails ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                  <Text style={styles.collapseToggleText}>İletişim detayları {showCustomerDetails ? '' : '(opsiyonel)'}</Text>
                </Pressable>

                {showCustomerDetails ? (
                  <>
                    <FormField compact label="Telefon" value={customer.phone} onChangeText={(value) => updateCustomer('phone', value)} keyboardType="phone-pad" />
                    <FormField compact label="E-posta" value={customer.email} onChangeText={(value) => updateCustomer('email', value)} keyboardType="email-address" autoCapitalize="none" />
                    <FormField compact label="Adres" value={customer.address} onChangeText={(value) => updateCustomer('address', value)} multiline />
                  </>
                ) : null}
              </Card>
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.section}>
              <StepCaption title="Ürünler" />

              <Card style={styles.panel}>
                <View style={styles.panelHeader}>
                  <Text style={styles.panelTitle}>Kayıtlı Ürün Ara</Text>
                  <Pressable style={styles.softButton} onPress={() => setShowProductResults((visible) => !visible)}>
                    <Ionicons name="list-outline" size={15} color={colors.primaryDark} />
                    <Text style={styles.softButtonText}>Liste</Text>
                  </Pressable>
                </View>

                <FormField
                  compact
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

                {showProductResults && catalogProducts.length > 0 ? (
                  <View style={styles.searchResults}>
                    {catalogProductsLoading ? <Text style={styles.hint}>Aranıyor…</Text> : null}
                    {catalogProductsError ? <Text style={styles.errorText}>{catalogProductsError}</Text> : null}
                    {catalogProducts.slice(0, 8).map((item) => (
                      <Pressable
                        key={item.id}
                        style={[styles.optionCard, selectedCatalogProductId === item.id && styles.optionCardActive]}
                        onPress={() => selectCatalogProduct(item)}
                      >
                        <View style={styles.optionBody}>
                          <Text style={styles.optionTitle} numberOfLines={1}>{item.stockName}</Text>
                          <Text style={styles.optionMeta}>{item.stockCode}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                <FormField compact label="Stok Kodu" value={draft.stockCode} onChangeText={(value) => updateDraft('stockCode', value)} placeholder="Stok kodu" autoCapitalize="characters" />
                <FormField compact label="Ürün Adı" value={draft.productName} onChangeText={(value) => updateDraft('productName', value)} placeholder="Ürün adı" />
                <View style={styles.twoColumn}>
                  <View style={styles.column}><FormField compact label="Marka" value={draft.brand} onChangeText={(value) => updateDraft('brand', value)} /></View>
                  <View style={styles.column}><FormField compact label="Model" value={draft.model} onChangeText={(value) => updateDraft('model', value)} /></View>
                </View>
                <View style={styles.twoColumn}>
                  <View style={styles.column}><FormField compact label="Seri No" value={draft.serialNumber} onChangeText={(value) => updateDraft('serialNumber', value)} /></View>
                  <View style={styles.quantityColumn}><FormField compact label="Adet" value={draft.quantity} onChangeText={(value) => updateDraft('quantity', value)} keyboardType="number-pad" /></View>
                </View>

                <Text style={styles.fieldLabel}>İşlem Türü</Text>
                <View style={styles.categoryRow}>
                  {CATEGORY_OPTIONS.map((option) => {
                    const active = draft.category === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        style={[styles.categoryChip, active && styles.categoryChipActive]}
                        onPress={() => updateDraft('category', option.value)}
                      >
                        <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <FormField compact label="Açıklama" value={draft.description} onChangeText={(value) => updateDraft('description', value)} multiline />

                <ProductImagePicker imageUri={draft.imageUri} onChange={(uri) => updateDraft('imageUri', uri)} />

                <SupplierButton
                  supplierName={draft.supplierName}
                  supplierCode={draft.supplierAccountCode}
                  onPress={() => setSupplierTargetId('draft')}
                  onClear={draft.supplierName ? () => removeSupplier('draft') : undefined}
                />

                <Pressable style={styles.addProductButton} onPress={addProduct}>
                  <Ionicons name="add-circle" size={18} color={colors.surface} />
                  <Text style={styles.addProductText}>Listeye Ekle</Text>
                </Pressable>
              </Card>

              <View style={styles.addedSection}>
                <View style={styles.addedSectionHeader}>
                  <Text style={styles.sectionTitle}>Eklenen ({products.length})</Text>
                </View>

                {products.length === 0 ? (
                  <Text style={styles.hint}>Henüz ürün eklenmedi.</Text>
                ) : (
                  products.map((product, index) => (
                    <Card key={product.id} style={styles.addedCard}>
                      <View style={styles.addedRow}>
                        <ProductImagePicker compact imageUri={product.imageUri} onChange={(uri) => updateProductImage(product.id, uri)} />
                        <View style={styles.addedBody}>
                          <View style={styles.addedHeader}>
                            <View style={styles.addedTitleBody}>
                              <Text style={styles.addedTitle} numberOfLines={2}>{index + 1}. {product.productName}</Text>
                            </View>
                            <Pressable style={styles.deleteButton} onPress={() => removeProduct(product.id)}>
                              <Ionicons name="trash-outline" size={16} color={colors.danger} />
                            </Pressable>
                          </View>
                          <Text style={styles.addedMeta} numberOfLines={1}>
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
              <StepCaption title="Özet ve Kaydet" />

              <Card style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Müşteri</Text>
                <SummaryRow label="Cari" value={customer.accountCode || '-'} />
                <SummaryRow label="Ad" value={customer.customerName || '-'} />
                <SummaryRow label="Ürün" value={String(products.length)} />
              </Card>

              {products.map((product, index) => (
                <Card key={product.id} style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>{index + 1}. {product.productName}</Text>
                  <SummaryRow label="Stok" value={product.stockCode || '-'} />
                  <SummaryRow label="İşlem" value={getCategoryLabel(product.category)} />
                  <SummaryRow label="Tedarikçi" value={product.supplierName ? `${product.supplierAccountCode}` : 'Atanmadı'} />
                </Card>
              ))}

              <Text style={styles.hint}>Tedarikçi durum değişiklikleri müşteri kaydına otomatik yansır.</Text>
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

function StepCaption({ title }: { title: string }) {
  return <Text style={styles.stepCaption}>{title}</Text>;
}

function SupplierButton({
  supplierName,
  supplierCode,
  onPress,
  onClear,
  compact}: {
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
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  section: { gap: spacing.md },
  stepCaption: { ...typography.subtitle, color: colors.text, fontWeight: '700' },
  panel: { gap: spacing.md, padding: spacing.md },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  panelTitle: { ...typography.bodyMedium, color: colors.text, fontWeight: '700' },
  sectionTitle: { ...typography.bodyMedium, color: colors.text, fontWeight: '700' },
  hint: { ...typography.caption, color: colors.textSecondary },
  errorText: { ...typography.caption, color: colors.danger },
  collapseToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  collapseToggleText: { ...typography.caption, color: colors.textMuted },
  softButton: {
    minHeight: 32,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm},
  softButtonText: { fontSize: 11, color: colors.primaryDark, fontWeight: '700' },
  searchResults: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.xs,
    gap: spacing.xs,
    maxHeight: 200},
  optionCard: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm},
  optionCardActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionBody: { flex: 1, gap: 1 },
  optionTitle: { fontSize: 13, lineHeight: 17, fontWeight: '600', color: colors.text },
  optionMeta: { fontSize: 11, lineHeight: 14, color: colors.textSecondary },
  twoColumn: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  column: { flex: 1 },
  quantityColumn: { width: 72 },
  fieldLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.text },
  categoryRow: { flexDirection: 'row', gap: spacing.xs },
  categoryChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    alignItems: 'center'},
  categoryChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  categoryChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
  categoryChipTextActive: { color: colors.primaryDark },
  supplierRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.xs },
  supplierRowCompact: { marginTop: spacing.xs },
  supplierButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm},
  supplierButtonAssigned: { borderColor: colors.success, backgroundColor: colors.successSoft },
  supplierIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center'},
  supplierBody: { flex: 1, gap: 1 },
  supplierLabel: { fontSize: 10, lineHeight: 13, fontWeight: '800', color: colors.textSecondary },
  supplierValue: { fontSize: 11, lineHeight: 14, color: colors.text, fontWeight: '600' },
  clearSupplierButton: {
    width: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center'},
  addProductButton: {
    minHeight: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md},
  addProductText: { fontSize: 14, color: colors.surface, fontWeight: '700' },
  addedSection: { gap: spacing.sm },
  addedSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addedCard: { gap: spacing.xs, padding: spacing.sm },
  addedRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  addedBody: { flex: 1, gap: 2 },
  addedHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.xs },
  addedTitleBody: { flex: 1 },
  addedTitle: { fontSize: 13, lineHeight: 17, fontWeight: '600', color: colors.text },
  addedMeta: { fontSize: 11, lineHeight: 14, color: colors.textSecondary },
  deleteButton: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center'},
  summaryCard: { gap: spacing.sm, padding: spacing.md },
  summaryTitle: { ...typography.bodyMedium, color: colors.text, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  summaryLabel: { fontSize: 11, color: colors.textMuted, width: 56 },
  summaryValue: { fontSize: 13, color: colors.text, flex: 1 },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.surface},
  placeholder: { flex: 1 },
  primaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md},
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs},
  primaryText: { fontSize: 14, color: colors.surface, textAlign: 'center', fontWeight: '700' },
  secondaryText: { fontSize: 14, color: colors.text },
  buttonDisabled: { opacity: 0.6 }});
