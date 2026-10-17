import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppearance } from '@/contexts/AppearanceContext';
import { absoluteMediaUrl, rmaApi, type MarketplaceProduct } from '@/lib/api';

export default function SupplierProductDetail() {
  const { slug, id } = useLocalSearchParams<{ slug: string; id: string }>();
  const router = useRouter();
  const { palette } = useAppearance();
  const [product, setProduct] = useState<MarketplaceProduct | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void rmaApi.getMarketplaceProduct(String(slug), String(id))
      .then(result => { if (active) setProduct(result); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Ürün yüklenemedi.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, id]);

  const shopUrl = 'https://pazaryeri.ecalisgan.com/magaza/' + encodeURIComponent(String(slug));
  const productUrl = shopUrl + '/urun/' + encodeURIComponent(String(id));
  const price = product?.content.price;
  const displayPrice = price == null || !Number.isFinite(Number(price))
    ? 'Fiyat için işletme hesabıyla giriş yapın'
    : Number(price).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';

  return <View style={[styles.root, { backgroundColor: palette.background }]}>
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={20} color={palette.text}/>
        <Text style={[styles.backText, { color: palette.text }]}>Tedarikçi ürünlerine dön</Text>
      </Pressable>
      {loading ? <Text style={{ color: palette.textSecondary }}>Ürün yükleniyor…</Text>
        : error || !product ? <View style={styles.empty}>
          <Text style={{ color: palette.textSecondary }}>{error || 'Onaylı ürün bulunamadı.'}</Text>
        </View> : <>
        <View style={styles.photo}>
          {product.content.imageUrl
            ? <Image source={{ uri: absoluteMediaUrl(product.content.imageUrl) || undefined }} style={styles.image} contentFit="contain"/>
            : <Ionicons name="cube-outline" size={70} color="#94A3B8"/>}
        </View>
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.sku, { color: palette.textSecondary }]}>Stok kodu: {product.sku}</Text>
          <Text style={[styles.name, { color: palette.text }]}>{product.content.name}</Text>
          <Pressable accessibilityRole="link" style={[styles.seller, { borderColor: palette.border }]}
            onPress={() => void Linking.openURL(shopUrl)}>
            <View style={styles.sellerAvatar}>
              {product.seller_logo_url
                ? <Image source={{ uri: absoluteMediaUrl(product.seller_logo_url) || undefined }} style={styles.avatarImage} contentFit="contain"/>
                : <Ionicons name="storefront" size={27} color="#92400E"/>}
            </View>
            <View style={styles.sellerText}>
              <View style={styles.verified}>
                <Text numberOfLines={1} style={[styles.sellerName, { color: palette.text }]}>{product.seller_name}</Text>
                <Ionicons name="checkmark-circle" size={16} color="#16A34A"/>
              </View>
              <Text style={styles.shopLink}>Mağazayı görüntüle →</Text>
            </View>
          </Pressable>
          <View style={[styles.priceWrap, { borderColor: palette.border }]}>
            <Text style={[styles.priceLabel, { color: palette.textSecondary }]}>Tedarikçi fiyatı</Text>
            <Text style={[styles.price, { color: palette.text }]}>{displayPrice}</Text>
            <Text style={[styles.info, { color: palette.textSecondary }]}>
              Koli içi {Math.max(1, Number(product.content.unitsPerBox) || 1)} adet · Minimum {Math.max(1, Number(product.content.minBoxes) || 1)} koli
            </Text>
          </View>
          {product.content.description
            ? <Text style={[styles.description, { color: palette.textSecondary }]}>{product.content.description}</Text>
            : null}
          <Pressable style={styles.button} onPress={() => void Linking.openURL(productUrl)}>
            <Ionicons name="open-outline" size={19} color="#111827"/>
            <Text style={styles.buttonText}>Pazaryerinde ürünü görüntüle</Text>
          </Pressable>
        </View>
      </>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 60 },
  back: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', minHeight: 46, gap: 5 },
  backText: { fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 70 },
  photo: { height: 320, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 22, justifyContent: 'center', alignItems: 'center' },
  image: { width: '100%', height: '100%' },
  card: { borderWidth: 1, borderRadius: 18, padding: 18, marginTop: 12, gap: 14 },
  sku: { fontSize: 11 },
  name: { fontSize: 21, lineHeight: 29, fontWeight: '900' },
  seller: { padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1 },
  sellerAvatar: { height: 48, width: 48, borderRadius: 12, backgroundColor: '#FFCD00', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%', backgroundColor: '#FFFFFF' },
  sellerText: { flex: 1 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sellerName: { fontSize: 13, fontWeight: '800', flexShrink: 1 },
  shopLink: { fontSize: 12, fontWeight: '700', color: '#A16207', marginTop: 4 },
  priceWrap: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 17, gap: 6 },
  priceLabel: { fontSize: 12 },
  price: { fontSize: 23, fontWeight: '900' },
  info: { fontSize: 12 },
  description: { fontSize: 13, lineHeight: 21 },
  button: { flexDirection: 'row', backgroundColor: '#FFCD00', borderRadius: 12, padding: 16, alignItems: 'center', justifyContent: 'center', gap: 7 },
  buttonText: { fontSize: 14, fontWeight: '800', color: '#111827' },
});
