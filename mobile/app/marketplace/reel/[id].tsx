import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { absoluteMediaUrl, rmaApi, type B2BReel } from '@/lib/api';

export default function SellerReelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [reel, setReel] = useState<B2BReel | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void rmaApi.listMarketplaceReels().then(rows => {
      if (active) setReel(rows.find(row => String(row.id) === String(id)) || null);
    }).catch(() => undefined).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  const url = absoluteMediaUrl(reel?.video_url);
  return <SafeAreaView style={styles.root}>
    <Pressable style={styles.back} onPress={() => router.back()} accessibilityLabel="Mağazaya dön">
      <Ionicons name="chevron-back" size={23} color="#FFFFFF"/><Text style={styles.backText}>Mağazaya dön</Text>
    </Pressable>
    {loading ? <ActivityIndicator color="#FFCD00"/> : url ?
      <Video source={{uri:url}} style={styles.video} resizeMode={ResizeMode.CONTAIN}
        shouldPlay isLooping useNativeControls /> :
      <Text style={styles.empty}>Video bulunamadı veya yayından kaldırıldı.</Text>}
    {reel ? <Text style={styles.title}>{reel.title}</Text> : null}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:'#050505',justifyContent:'center'},
  back:{position:'absolute',top:12,left:15,zIndex:2,flexDirection:'row',alignItems:'center',gap:4},
  backText:{color:'#FFFFFF',fontSize:14,fontWeight:'800'},
  video:{width:'100%',height:'80%'},
  title:{color:'#FFFFFF',fontWeight:'800',paddingHorizontal:20,fontSize:16},
  empty:{color:'#FFFFFF',textAlign:'center',padding:20},
});
