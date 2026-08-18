import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { getInitials } from '@/lib/format';

const SECTIONS = [
  {
    title: 'Hesap',
    items: [
      { icon: 'person-outline' as const, label: 'Profil Bilgileri', soon: true },
      { icon: 'lock-closed-outline' as const, label: 'Şifre ve Güvenlik', soon: true },
    ],
  },
  {
    title: 'Uygulama',
    items: [
      { icon: 'notifications-outline' as const, label: 'Bildirimler', soon: true },
      { icon: 'information-circle-outline' as const, label: 'Uygulama Hakkında', soon: false },
    ],
  },
];

export default function ProfileScreen() {
  const { user, loading, signOut, deleteAccount } = useAuth();
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleLogout = () => {
    Alert.alert('Çıkış Yap', 'Oturumunuz kapatılacak.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Çıkış Yap',
        style: 'destructive',
        onPress: () => {
          signOut().catch((error) => {
            Alert.alert('Hata', error instanceof Error ? error.message : 'Çıkış yapılamadı.');
          });
        },
      },
    ]);
  };

  const performAccountDeletion = async () => {
    if (deletingAccount) return;
    setDeletingAccount(true);
    try {
      await deleteAccount();
    } catch (error) {
      setDeletingAccount(false);
      Alert.alert(
        'Hesap Silinemedi',
        error instanceof Error ? error.message : 'Hesap silme işlemi tamamlanamadı.',
      );
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Hesabımı Sil',
      'Bu işlem geri alınamaz. Hesabınız, size ait RMA kayıtları, ürün ve cari katalogları ile tedarikçi kayıtları kalıcı olarak silinir.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Devam Et',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Son Onay',
              'Hesabınızı ve hesabınıza bağlı verileri kalıcı olarak silmek istediğinizden emin misiniz?',
              [
                { text: 'Vazgeç', style: 'cancel' },
                {
                  text: 'Hesabımı Sil',
                  style: 'destructive',
                  onPress: () => {
                    void performAccountDeletion();
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split('@')[0] ||
    'Kullanıcı';

  return (
    <Screen>
      <AppHeader title="Hesabım" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
          </View>
          <View>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.role}>{user?.email ?? '-'}</Text>
            <Text style={styles.privacyNote}>Kayıtlarınız yalnızca bu hesaba özeldir.</Text>
          </View>
        </Card>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Card style={styles.menuCard}>
              {section.items.map((item, index) => (
                <View key={item.label}>
                  <Pressable style={styles.menuRow}>
                    <Ionicons name={item.icon} size={20} color={colors.textSecondary} />
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    {item.soon ? <Text style={styles.soon}>Yakında</Text> : null}
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                  {index < section.items.length - 1 ? <View style={styles.divider} /> : null}
                </View>
              ))}
            </Card>
          </View>
        ))}

        <Pressable style={styles.logout} onPress={handleLogout}>
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </Pressable>

        <Pressable
          style={[styles.deleteAccount, deletingAccount && styles.disabledAction]}
          onPress={handleDeleteAccount}
          disabled={deletingAccount}
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={styles.deleteAccountText}>
            {deletingAccount ? 'Hesap Siliniyor...' : 'Hesabımı Sil'}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  profileCard: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 18,
  },
  name: {
    ...typography.title,
    color: colors.text,
  },
  role: {
    ...typography.body,
    color: colors.textSecondary,
  },
  privacyNote: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  menuCard: {
    padding: 0,
    overflow: 'hidden',
  },
  menuRow: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  menuLabel: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  soon: {
    ...typography.caption,
    color: colors.warning,
    marginRight: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: spacing.lg + 28,
  },
  logout: {
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  logoutText: {
    ...typography.bodyMedium,
    color: colors.danger,
  },
  deleteAccount: {
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  deleteAccountText: {
    ...typography.bodyMedium,
    color: colors.danger,
  },
  disabledAction: {
    opacity: 0.6,
  },
});
