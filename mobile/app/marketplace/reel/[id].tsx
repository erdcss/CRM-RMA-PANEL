import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, type ViewToken } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { rmaApi, type B2BReel } from '@/lib/api';
import { ReelCard } from '../../(tabs)/discover';

export default function SellerReelScreen() {
  const { id } = useLocalSearchParams<{id:string}>();
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
  useEffect(() => {
    let mounted = true;
    void rmaApi.listMarketplaceReels().then(rows => {
      if(mounted) setReels(rows);
    }).catch(() => undefined).finally(() => {
      if(mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);
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
        renderItem={({item,index})=><ReelCard item={item} active={focused&&index===activeIndex} height={height}/>}
        pagingEnabled decelerationRate="fast" showsVerticalScrollIndicator={false} bounces={false}
        onViewableItemsChanged={onVisible} viewabilityConfig={config}
        getItemLayout={(_,index)=>({length:height,offset:height*index,index})}
      /> : <View style={styles.empty}>{loading?<ActivityIndicator color="#FFCD00"/>:
        <Text style={styles.emptyText}>Video bulunamadı veya yayından kaldırıldı.</Text>}</View>}
      <Pressable style={styles.back} onPress={()=>router.back()} accessibilityRole="button" accessibilityLabel="Mağazaya dön">
        <Ionicons name="chevron-back" color="#FFFFFF" size={21}/><Text style={styles.backText}>Geri</Text>
      </Pressable>
    </View>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#050505'},
  viewport:{flex:1,backgroundColor:'#050505'},
  back:{position:'absolute',top:9,left:12,zIndex:20,flexDirection:'row',alignItems:'center',gap:3,paddingVertical:7,paddingHorizontal:10,borderRadius:20,backgroundColor:'rgba(0,0,0,0.54)'},
  backText:{fontSize:13,fontWeight:'800',color:'#FFFFFF'},
  empty:{flex:1,alignItems:'center',justifyContent:'center'},
  emptyText:{color:'#FFFFFF',fontSize:14},
});
