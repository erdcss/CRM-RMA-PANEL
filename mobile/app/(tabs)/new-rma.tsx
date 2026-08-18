import { useMemo, useState } from 'react';
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
import { useCustomers, useCatalogProducts } from '@/hooks/useRmaData';
import { rmaApi, type RmaCustomer, type CatalogProduct } from '@/lib/api';
import { uploadProductPhoto } from '@/lib/attachments';
import { recordHref } from '@/lib/routes';

type CustomerForm = {
  customerName: string;
  phone: string;
  email: string;
  address: string;
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
  phone: '',
  email: '',
  address: '',
};

export default function NewRmaScreen() {
  const router = useRouter();
  const { customers, refresh: refreshCustomers } = useCustomers();
  const [catalogQuery, setCatalogQuery] = useState('');
  const { products: catalogProducts } = useCatalogProducts(catalogQuery);
  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState<CustomerForm>(emptyCustomer);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [products, setProducts] = useState<ProductDraft[]>([]);
  const [draft, setDraft] = useState<ProductDraft>(emptyProductDraft);
  const [customerQuery, setCustomerQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter((item) =>
        [item.name, item.phone, item.email].filter(Boolean).join(' ').toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [customers, customerQuery]);

  const updateCustomer = (key: keyof CustomerForm, value: string) => {
    setSelectedCustomerId(null);
    setCustomer((prev) => ({ ...prev, [key]: value }));
  };

  const updateDraft = (key: keyof ProductDraft, value: string | null) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const selectCustomer = (item: RmaCustomer) => {
    setSelectedCustomerId(item.id);
    setCustomer({
      customerName: item.name || '',
      phone: item.phone || '',
      email: item.email || '',
      address: item.address || '',
    });
    setCustomerQuery(item.name || '');
  };

  const addProduct = () => {
    if (!draft.productName.trim()) {
      Alert.alert('Eksik bilgi', 'Ürün adı girin.');
      return;
    }

    setProducts((prev) => [...prev, draft]);
    setDraft(emptyProductDraft());
  };

  const removeProduct = (id: string) => {
    setProducts((prev) => prev.filter((item) => item.id !== id));
  };

  const canContinue = () => {
    if (step === 1) return customer.customerName.trim().length > 0 || customer.phone.trim().length > 0;
    if (step === 2) return products.length > 0;
    return true;
  };

  const updateProductImage = (id: string, imageUri: string | null) => {
    setProducts((prev) => prev.map((item) => (item.id === id ? { ...item, imageUri } : item)));
  };

  const selectCatalogProduct = (item: CatalogProduct) => {
    setDraft((prev) => ({
      ...prev,
      stockCode: item.stockCode,
      productName: item.stockName,
    }));
    setCatalogQuery(item.stockCode);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const ticket = await rmaApi.createTicket({
        customerName: customer.customerName,
        phone: customer.phone || '-',
        email: customer.email || undefined,
        address: customer.address || undefined,
        products: products.map((product) => ({
          name: product.productName,
          brand: product.brand || undefined,
          model: product.model || undefined,
          serialNumber: product.serialNumber || undefined,
          stockCode: product.stockCode || undefined,
          category: product.category,
          description: product.description || undefined,
          quantity: Number(product.quantity) || 1,
        })),
      });

      await Promise.all(
        products.map(async (product, index) => {
          const created = ticket.products[index];
          if (product.imageUri && created) {
            await uploadProductPhoto(ticket.id, created.id, product.imageUri);
          }
        }),
      );

      setCustomer(emptyCustomer);
      setProducts([]);
      setDraft(emptyProductDraft());
      setSelectedCustomerId(null);
      setCustomerQuery('');
      setStep(1);
      refreshCustomers();
      router.replace(recordHref(ticket.id));
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
              <FormField
                label="Müşteri Ara"
                value={customerQuery}
                onChangeText={setCustomerQuery}
                placeholder="Ad, telefon veya e-posta"
              />
              <View style={styles.customerList}>
                {filteredCustomers.map((item) => {
                  const active = selectedCustomerId === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.customerItem, active && styles.customerItemActive]}
                      onPress={() => selectCustomer(item)}
                    >
                      <Text style={styles.customerName}>{item.name}</Text>
                      <Text style={styles.customerMeta}>{item.phone}</Text>
                      {item.ticketCount ? (
                        <Text style={styles.customerMeta}>{item.ticketCount} önceki kayıt</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.dividerLabel}>veya yeni müşteri bilgilerini girin</Text>
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
                Kayıt oluşturulduğunda müşteri telefon numarasına göre kaydedilir; sonraki işlemlerde listeden seçilebilir.
              </Text>
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ürün Bilgileri</Text>

              <FormField
                label="Stok Kodu"
                value={draft.stockCode}
                onChangeText={(v) => {
                  updateDraft('stockCode', v);
                  setCatalogQuery(v);
                }}
                placeholder="Stok kodu yazın veya listeden seçin"
              />
              {catalogQuery.trim().length > 1 ? (
                <View style={styles.catalogList}>
                  {catalogProducts.slice(0, 6).map((item) => (
                    <Pressable
                      key={item.id}
                      style={styles.catalogItem}
                      onPress={() => selectCatalogProduct(item)}
                    >
                      <Text style={styles.catalogCode}>{item.stockCode}</Text>
                      <Text style={styles.catalogName}>{item.stockName}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <FormField label="Ürün Adı" value={draft.productName} onChangeText={(v) => updateDraft('productName', v)} />
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

              <ProductImagePicker
                imageUri={draft.imageUri}
                onChange={(uri) => updateDraft('imageUri', uri)}
              />

              <Pressable style={styles.addButton} onPress={addProduct}>
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.addButtonText}>Ürünü Listeye Ekle</Text>
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
                            <Pressable onPress={() => removeProduct(product.id)}>
                              <Ionicons name="trash-outline" size={18} color={colors.danger} />
                            </Pressable>
                          </View>
                          <Text style={styles.addedMeta}>
                            {product.stockCode ? `${product.stockCode} · ` : ''}
                            {getCategoryLabel(product.category)} · Seri: {product.serialNumber || '-'}
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
              <Card style={styles.summaryCard}>
                <SummaryRow label="Müşteri" value={customer.customerName || '-'} />
                <SummaryRow label="Telefon" value={customer.phone || '-'} />
                <SummaryRow label="E-posta" value={customer.email || '-'} />
                <SummaryRow label="Ürün sayısı" value={String(products.length)} />
              </Card>

              {products.map((product, index) => (
                <Card key={product.id} style={styles.summaryCard}>
                  <Text style={styles.productSummaryTitle}>Ürün {index + 1}</Text>
                  <SummaryRow label="Stok Kodu" value={product.stockCode || '-'} />
                  <SummaryRow label="Ad" value={product.productName} />
                  <SummaryRow label="Marka / Model" value={[product.brand, product.model].filter(Boolean).join(' ') || '-'} />
                  <SummaryRow label="Seri No" value={product.serialNumber || '-'} />
                  <SummaryRow label="İşlem" value={getCategoryLabel(product.category)} />
                  <SummaryRow label="Açıklama" value={product.description || '-'} />
                </Card>
              ))}
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {step > 1 ? (
            <Pressable style={styles.secondaryButton} onPress={() => setStep((s) => s - 1)}>
              <Text style={styles.secondaryText}>Geri</Text>
            </Pressable>
          ) : (
            <View style={styles.placeholder} />
          )}

          {step < 3 ? (
            <Pressable
              style={[styles.primaryButton, !canContinue() && styles.buttonDisabled]}
              disabled={!canContinue()}
              onPress={() => setStep((s) => s + 1)}
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
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  catalogList: {
    gap: spacing.xs,
  },
  catalogItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: 2,
  },
  catalogCode: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  catalogName: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  customerList: {
    gap: spacing.sm,
  },
  customerItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: 2,
  },
  customerItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  customerName: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  customerMeta: {
    ...typography.caption,
    color: colors.textSecondary,
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
  summaryCard: {
    gap: spacing.md,
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
  },
  secondaryText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
