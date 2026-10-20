import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View, type ViewToken } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { rmaApi, type B2BReel } from '@/lib/api';
import { ReelCard } from '../../(tabs)/discover';

export default function SellerReelScreen() {
  const { id, slug } = useLocalSearchParams<{id:string;slug?:string}>();
  const router = useRouter();
  const [reels, setReels] = useState<B2BReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [focused, setFocused] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [height, setHeight] = useState(0);
  const listRef = useRef<FlatList<B2BReel>>(null);
  const initialScrolled = useRef(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  const returnToStore = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else if (slug) {
      router.replace({ pathname: '/marketplace/store/[slug]', params: { slug } } as never);
    } else {
      router.replace('/(tabs)/discover' as never);
    }
  }, [router, slug]);
  useEffect(() => {
    let mounted = true;
    void rmaApi.listMarketplaceReels().then(rows => {
      // Store entry shows that supplier's videos using the exact shared Reels UI.
      if (mounted) setReels(slug ? rows.filter(reel => reel.seller_slug === slug) : rows);
    }).catch(() => undefined).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [slug]);
  const firstIndex = useMemo(() => Math.max(0, reels.findIndex(r => String(r.id) === String(id))), [reels, id]);
  useEffect(() => {
    if (!reels.length || !height || initialScrolled.current) return;
    initialScrolled.current = true;
    setActiveIndex(firstIndex);
    listRef.current?.scrollToOffset({offset:height * firstIndex,animated:false});
  }, [reels,height,firstIndex]);
  const config = useRef({itemVisiblePercentThreshold:72,minimumViewTime:120}).current;
  const onVisible = useRef(({viewableItems}:{viewableItems:ViewToken<B2BReel>[]}) => {
    const index = viewableItems.find(item=>item.isViewable)?.index;
    if(typeof index === 'number') setActiveIndex(index);
  }).current;
  return <SafeAreaView style={styles.root} edges={['top','bottom']}>
    <View style={styles.viewport} onLayout={e=>setHeight(e.nativeEvent.layout.height)}>
      {height > 0 && reels.length ? <FlatList ref={listRef} data={reels}
        keyExtractor={item=>String(item.id)}
        renderItem={({item,index})=><ReelCard item={item} active={focused&&index===activeIndex} height={height} onBack={returnToStore}/>}
        pagingEnabled decelerationRate="fast" showsVerticalScrollIndicator={false} bounces={false}
        onViewableItemsChanged={onVisible} viewabilityConfig={config}
        getItemLayout={(_,index)=>({length:height,offset:height*index,index})}
      /> : <View style={styles.empty}>{loading?<ActivityIndicator color="#FFCD00"/>:
        <Text style={styles.emptyText}>Video bulunamadı veya yayından kaldırıldı.</Text>}</View>}
    </View>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#050505'},
  viewport:{flex:1,backgroundColor:'#050505'},
  empty:{flex:1,alignItems:'center',justifyContent:'center'},
  emptyText:{color:'#FFFFFF',fontSize:14},
});
