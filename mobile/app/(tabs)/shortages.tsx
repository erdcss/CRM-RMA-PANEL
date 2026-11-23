import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { useAppearance, type AppPalette } from '@/contexts/AppearanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { rmaApi, type B2BShortageList, type B2BShortageSupplier, type B2BShortageItem } from '@/lib/api';
import { appAlert } from '@/lib/appAlert';
import { radius, spacing, typography } from '@/constants/theme';
import { useRouter } from 'expo-router';

const EMPTY: B2BShortageList = { suppliers: [], revision: 0 };
const freshId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export default function ShortagesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { palette } = useAppearance();
  const styles = useMemo(() => buildStyles(palette), [palette]);
  const [list, setList] = useState<B2BShortageList>(EMPTY);
  const [openSupplier, setOpenSupplier] = useState<string | null>(null);
  const [newSupplier, setNewSupplier] = useState('');
  const [newProducts, setNewProducts] = useState<Record<string, string>>({});
  const [editSupplier, setEditSupplier] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) {
      setList(EMPTY);
      setOpenSupplier(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const latest = await rmaApi.getB2BShortages();
      setList(latest);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Liste yüklenemedi.');
    } finally { setLoading(false); }
  }, [session?.access_token]);

  useEffect(() => { void load(); }, [load]);

  async function commit(change: (current: B2BShortageSupplier[]) => B2BShortageSupplier[]) {
    if (saving || loading || !session) return false;
    const previous = list;
    const suppliers = change(previous.suppliers);
    setList({ ...previous, suppliers });
    setSaving(true);
    try {
      const saved = await rmaApi.saveB2BShortages({ ...previous, suppliers });
      setList(saved);
      return true;
    } catch (failure) {
      setList(previous);
      const message = failure instanceof Error ? failure.message : 'Liste kaydedilemedi.';
      appAlert('Kayıt başarısız', message, undefined, 'error');
      if (/başka cihazda|409/i.test(message)) await load();
      return false;
    } finally { setSaving(false); }
  }

  async function addSupplier() {
    const name = newSupplier.trim();
    if (!name) return;
    const id = freshId();
    const done = await commit(rows => [...rows, { id, name, items: [] }]);
    if (done) { setNewSupplier(''); setOpenSupplier(id); }
  }

  async function addItem(supplierId: string) {
    const name = (newProducts[supplierId] || '').trim();
    if (!name) return;
    const id = freshId();
    const done = await commit(rows => rows.map(supplier =>
      supplier.id === supplierId ? { ...supplier, items: [...supplier.items, { id, name, completed: false }] } : supplier
    ));
    if (done) setNewProducts(current => ({ ...current, [supplierId]: '' }));
  }

  async function toggleItem(supplierId: string, itemId: string) {
    await commit(rows => rows.map(supplier =>
      supplier.id === supplierId ? { ...supplier, items: supplier.items.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      ) } : supplier
    ));
  }

  async function saveEdit() {
    const name = editText.trim();
    if (!name) { appAlert('Bilgi eksik', 'Bir ad yazın.'); return; }
    const supplierId = editSupplier;
    const itemId = editItem;
    const done = await commit(rows => rows.map(supplier => {
      if (supplierId && supplier.id === supplierId) return { ...supplier, name };
      if (itemId && supplier.items.some(item => item.id === itemId)) {
        return { ...supplier, items: supplier.items.map(item =>
          item.id === itemId ? { ...item, name } : item) };
      }
      return supplier;
    }));
    if (done) { setEditSupplier(null); setEditItem(null); setEditText(''); }
  }

  function confirmRemoveSupplier(supplier: B2BShortageSupplier) {
    Alert.alert('Firmayı sil', supplier.name + ' ve tüm eksik ürünleri silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => {
        void (async () => {
          const done = await commit(rows => rows.filter(row => row.id !== supplier.id));
          if (done && openSupplier === supplier.id) setOpenSupplier(null);
        })();
      }},
    ]);
  }

  function confirmRemoveItem(supplierId: string, item: B2BShortageItem) {
    Alert.alert('Ürünü sil', item.name + ' listesinden kaldırılsın mı?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => { void commit(rows => rows.map(supplier =>
        supplier.id === supplierId ? { ...supplier, items: supplier.items.filter(row => row.id !== item.id) } : supplier
      )); }},
    ]);
  }

  const productCount = list.suppliers.reduce((n, supplier) => n + supplier.items.length, 0);
  const waitingCount = list.suppliers.reduce((n, supplier) =>
    n + supplier.items.filter(item => !item.completed).length, 0);

  return (
    <Screen style={{ backgroundColor: palette.background }}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Eksik Listem</Text>
            <Text style={styles.subtitle}>Tedarikçilerine göre ürün ihtiyaçlarını takip et.</Text>
          </View>
          {saving ? <ActivityIndicator color="#EAB308" /> : null}
        </View>

        {!session ? (
          <View style={styles.empty}>
            <Ionicons name="lock-closed-outline" size={34} color={palette.textSecondary} />
            <Text style={styles.emptyTitle}>Listeleriniz size özel</Text>
            <Text style={styles.emptyMessage}>Firmalarınız ve ürün eksikleriniz hesabınızda güvenle saklanır. Kullanmak için giriş yapın.</Text>
            <Pressable style={styles.primary} onPress={() => router.push('/login')}>
              <Text style={styles.primaryText}>Giriş Yap</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.summary}>
              <View><Text style={styles.summaryNumber}>{list.suppliers.length}</Text><Text style={styles.summaryLabel}>Firma</Text></View>
              <View style={styles.summaryDivider} />
              <View><Text style={styles.summaryNumber}>{waitingCount}</Text><Text style={styles.summaryLabel}>Bekleyen ürün</Text></View>
              <View style={styles.summaryDivider} />
              <View><Text style={styles.summaryNumber}>{productCount - waitingCount}</Text><Text style={styles.summaryLabel}>Tamamlanan</Text></View>
            </View>

            <View style={styles.addSupplierBox}>
              <Text style={styles.sectionTitle}>Firma ekle</Text>
              <View style={styles.addRow}>
                <TextInput style={[styles.input, styles.flex]} placeholder="Tedarikçi veya firma adı"
                  placeholderTextColor={palette.muted} value={newSupplier} onChangeText={setNewSupplier}
                  maxLength={120} editable={!saving && !loading} returnKeyType="done"
                  onSubmitEditing={() => void addSupplier()} />
                <Pressable disabled={saving || loading || !newSupplier.trim()} style={[styles.addButton, (saving || !newSupplier.trim()) && styles.disabled]}
                  onPress={() => void addSupplier()} accessibilityLabel="Firma ekle">
                  <Ionicons name="add" size={24} color="#111827" />
                </Pressable>
              </View>
            </View>

            {error ? (
              <Pressable style={styles.error} onPress={() => void load()}>
                <Text style={styles.errorText}>{error} · Yeniden dene</Text>
              </Pressable>
            ) : null}
            {loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} color={palette.text} /> : null}
            {!loading && !error && list.suppliers.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="receipt-outline" size={34} color={palette.muted} />
                <Text style={styles.emptyTitle}>Henüz firma yok</Text>
                <Text style={styles.emptyMessage}>İlk firmanı ekle; her firma için ayrı eksik ürün listesi tut.</Text>
              </View>
            ) : null}

            {list.suppliers.map((supplier) => {
              const opened = openSupplier === supplier.id;
              const outstanding = supplier.items.filter(item => !item.completed).length;
              return (
                <View key={supplier.id} style={styles.supplierCard}>
                  <Pressable style={styles.supplierHeader} onPress={() => {
                    setOpenSupplier(opened ? null : supplier.id);
                    setEditItem(null); setEditSupplier(null);
                  }} accessibilityRole="button" accessibilityState={{ expanded: opened }}>
                    <View style={styles.supplierIcon}><Ionicons name="business-outline" size={20} color={palette.text} /></View>
                    <View style={styles.supplierHeading}>
                      <Text style={styles.supplierName} numberOfLines={2}>{supplier.name}</Text>
                      <Text style={styles.supplierMeta}>{outstanding} eksik · {supplier.items.length} ürün</Text>
                    </View>
                    <Ionicons name={opened ? 'chevron-up' : 'chevron-down'} color={palette.textSecondary} size={22} />
                  </Pressable>

                  {opened ? (
                    <View style={styles.drawer}>
                      <View style={styles.actions}>
                        <Pressable onPress={() => { setEditSupplier(supplier.id); setEditItem(null); setEditText(supplier.name); }} style={styles.textButton} disabled={saving}>
                          <Ionicons name="pencil-outline" color={palette.textSecondary} size={16} />
                          <Text style={styles.actionLabel}>Firma adını değiştir</Text>
                        </Pressable>
                        <Pressable onPress={() => confirmRemoveSupplier(supplier)} style={styles.textButton} disabled={saving}>
                          <Ionicons name="trash-outline" color="#DC2626" size={16} />
                          <Text style={styles.dangerLabel}>Firmayı sil</Text>
                        </Pressable>
                      </View>
                      {editSupplier === supplier.id ? (
                        <View style={styles.editRow}>
                          <TextInput style={[styles.input, styles.flex]} value={editText} onChangeText={setEditText}
                            autoFocus maxLength={120} editable={!saving} />
                          <Pressable onPress={() => void saveEdit()} disabled={saving} style={styles.smallPrimary}><Ionicons name="checkmark" color="#111827" size={21}/></Pressable>
                          <Pressable onPress={() => setEditSupplier(null)} style={styles.smallSecondary}><Ionicons name="close" color={palette.text} size={21}/></Pressable>
                        </View>
                      ) : null}
                      {supplier.items.length === 0 ? (
                        <Text style={styles.noItems}>Bu firmada henüz eksik ürün yok.</Text>
                      ) : supplier.items.map((item) => (
                        <View key={item.id} style={styles.itemRow}>
                          <Pressable onPress={() => void toggleItem(supplier.id, item.id)} disabled={saving}
                            style={[styles.checkbox, item.completed && styles.checkboxOn]}
                            accessibilityRole="checkbox" accessibilityState={{ checked: item.completed }} accessibilityLabel={item.name + ' tamamlandı'}>
                            {item.completed ? <Ionicons name="checkmark" size={16} color="#111827" /> : null}
                          </Pressable>
                          {editItem === item.id ? (
                            <View style={styles.editRow}>
                              <TextInput value={editText} onChangeText={setEditText} style={[styles.input, styles.flex]}
                                maxLength={240} autoFocus editable={!saving} onSubmitEditing={() => void saveEdit()} />
                              <Pressable onPress={() => void saveEdit()} disabled={saving} style={styles.smallPrimary}><Ionicons name="checkmark" color="#111827" size={19}/></Pressable>
                              <Pressable onPress={() => setEditItem(null)} style={styles.smallSecondary}><Ionicons name="close" color={palette.text} size={19}/></Pressable>
                            </View>
                          ) : (
                            <>
                              <Text style={[styles.itemName, item.completed && styles.completed]}>{item.name}</Text>
                              <Pressable style={styles.itemAction} onPress={() => { setEditItem(item.id); setEditSupplier(null); setEditText(item.name); }} disabled={saving} accessibilityLabel="Ürünü düzenle">
                                <Ionicons name="pencil-outline" size={18} color={palette.textSecondary}/>
                              </Pressable>
                              <Pressable style={styles.itemAction} onPress={() => confirmRemoveItem(supplier.id, item)} disabled={saving} accessibilityLabel="Ürünü sil">
                                <Ionicons name="trash-outline" size={18} color="#DC2626"/>
                              </Pressable>
                            </>
                          )}
                        </View>
                      ))}
                      <View style={styles.addProductRow}>
                        <TextInput style={[styles.input, styles.flex]} placeholder="Eksik ürün ekle..."
                          placeholderTextColor={palette.muted} value={newProducts[supplier.id] || ''}
                          onChangeText={(value) => setNewProducts(current => ({ ...current, [supplier.id]: value }))}
                          maxLength={240} editable={!saving} returnKeyType="done"
                          onSubmitEditing={() => void addItem(supplier.id)} />
                        <Pressable style={[styles.addButton, (saving || !(newProducts[supplier.id] || '').trim()) && styles.disabled]}
                          onPress={() => void addItem(supplier.id)} disabled={saving || !(newProducts[supplier.id] || '').trim()} accessibilityLabel="Ürün ekle">
                          <Ionicons name="add" size={24} color="#111827"/>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const buildStyles = (palette: AppPalette) => StyleSheet.create({
  page: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm },
  headerText: { flex: 1 },
  title: { ...typography.title, color: palette.text, fontWeight: '900' },
  subtitle: { ...typography.caption, color: palette.textSecondary, marginTop: 5 },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderWidth: 1, borderColor: palette.border, borderRadius: radius.lg, backgroundColor: palette.surface, paddingVertical: spacing.lg },
  summaryNumber: { fontSize: 23, fontWeight: '900', color: palette.text, textAlign: 'center' },
  summaryLabel: { ...typography.caption, color: palette.textSecondary, fontSize: 11, marginTop: 2 },
  summaryDivider: { width: 1, height: 35, backgroundColor: palette.border },
  addSupplierBox: { gap: spacing.sm, padding: spacing.md, backgroundColor: palette.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border },
  sectionTitle: { ...typography.subtitle, fontWeight: '800', color: palette.text },
  addRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  flex: { flex: 1 },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.background, color: palette.text, paddingHorizontal: spacing.md, ...typography.body },
  addButton: { height: 46, width: 46, borderRadius: radius.md, backgroundColor: '#FACC15', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  supplierCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, overflow: 'hidden' },
  supplierHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md, minHeight: 68 },
  supplierIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: palette.surfaceSecondary },
  supplierHeading: { flex: 1 },
  supplierName: { ...typography.bodyMedium, color: palette.text, fontWeight: '800' },
  supplierMeta: { ...typography.caption, color: palette.textSecondary, marginTop: 4 },
  drawer: { borderTopWidth: 1, borderColor: palette.border, padding: spacing.md, gap: spacing.md },
  actions: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  textButton: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32 },
  actionLabel: { fontSize: 12, color: palette.textSecondary, fontWeight: '600' },
  dangerLabel: { fontSize: 12, color: '#DC2626', fontWeight: '700' },
  editRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  smallPrimary: { minWidth: 35, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FACC15' },
  smallSecondary: { minWidth: 35, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surfaceSecondary },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: palette.border, paddingVertical: spacing.sm, minHeight: 51 },
  checkbox: { width: 25, height: 25, borderRadius: 7, borderWidth: 1.5, borderColor: palette.textSecondary, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: '#FACC15', borderColor: '#FACC15' },
  itemName: { ...typography.bodyMedium, flex: 1, color: palette.text },
  completed: { color: palette.muted, textDecorationLine: 'line-through' },
  itemAction: { minWidth: 31, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  addProductRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  noItems: { ...typography.caption, color: palette.textSecondary, textAlign: 'center', paddingVertical: spacing.lg },
  empty: { borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, padding: spacing.xl, marginTop: spacing.lg, alignItems: 'center', gap: spacing.md, backgroundColor: palette.surface },
  emptyTitle: { ...typography.subtitle, color: palette.text, fontWeight: '800' },
  emptyMessage: { ...typography.body, color: palette.textSecondary, textAlign: 'center' },
  primary: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.md, backgroundColor: '#FACC15' },
  primaryText: { color: '#111827', fontWeight: '800' },
  error: { borderRadius: radius.md, padding: spacing.md, backgroundColor: palette.surfaceSecondary },
  errorText: { ...typography.caption, color: '#DC2626' },
});
