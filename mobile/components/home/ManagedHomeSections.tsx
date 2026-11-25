import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useAppearance } from '@/contexts/AppearanceContext';
import { absoluteMediaUrl, homepageMediaUrl, type B2BProduct, type B2BReel, type B2BTimedCampaign, type HomeSection } from '@/lib/api';
import { TimedCampaignNotice } from '@/components/products/TimedCampaignNotice';

export const DEFAULT_MOBILE_HOME_SECTIONS: HomeSection[] = [
  {id:'actions',title:'Hızlı İşlemler',enabled:true,productIds:[],brands:[]},
  {id:'flash',title:'Flash Ürünler',enabled:true,productIds:[],brands:[]},
  {id:'special',title:'Sana Özel Fırsatlar',enabled:true,productIds:[],brands:[]},
  {id:'reorder',title:'Hızlı Tekrar Sipariş',enabled:true,productIds:[],brands:[]},
  {id:'videos',title:'Video ile Keşfet',enabled:true,productIds:[],brands:[]},
  {id:'bestsellers',title:'Çok Satanlar',enabled:true,productIds:[],brands:[]},
  {id:'brands',title:'Markalar',enabled:true,productIds:[],brands:[]},
];
type Props = {
  sections: HomeSection[];
  products: B2BProduct[];
  bestSellerProductIds: string[];
  campaigns: B2BTimedCampaign[];
  reels: B2BReel[];
  now: number;
  signedIn: boolean;
  renderProduct: (item: B2BProduct) => ReactNode;
  onRefresh: () => void;
  onOpenScanner: () => void;
  onRoute: (path: string) => void;
  onBrand: (name: string) => void;
};
function SectionHead({icon,title,action,onAction}:{icon:keyof typeof Ionicons.glyphMap;title:string;action?:string;onAction?:()=>void}) {
  return <View style={styles.head}>
    <View style={styles.headLeft}>
      <Ionicons name={icon} size={23} color="#FFCD00" />
      <Text style={styles.heading} numberOfLines={2}>{title}</Text>
    </View>
    {action&&onAction?<Pressable onPress={onAction} accessibilityRole="button"
      accessibilityLabel={action} style={styles.seeAll}>
      <Text style={styles.seeAllText}>{action}</Text>
      <Ionicons name="chevron-forward" color="#FFCD00" size={17}/>
    </Pressable>:null}
  </View>;
}
function ItemStrip({products,renderProduct}:{products:B2BProduct[];renderProduct:Props['renderProduct']}) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.productScroll}>
    {products.map(product=>renderProduct(product))}
  </ScrollView>;
}
const shortActionItems: Array<{id:'scan'|'orders'|'ledger'|'campaigns';label:string;subtitle:string;icon:keyof typeof Ionicons.glyphMap;route:string}> = [
  {id:'scan',label:'Hızlı Sipariş',subtitle:'Barkodla bul',icon:'flash',route:''},
  {id:'orders',label:'Tekrar Sipariş',subtitle:'Yeniden al',icon:'repeat-outline',route:'/my-orders'},
  {id:'ledger',label:'Cari Hesap',subtitle:'Bakiye gör',icon:'cash-outline',route:'/ledger'},
  {id:'campaigns',label:'Kampanyalar',subtitle:'Fırsatları gör',icon:'pricetag-outline',route:'/campaigns'},
];
function QuickActionIcon({imageId,icon}:{imageId?:string;icon:keyof typeof Ionicons.glyphMap}){
  const [failed,setFailed]=useState(false);
  const uri=homepageMediaUrl(imageId);
  return uri&&!failed
    ? <Image source={{uri}} style={styles.actionIcon} contentFit="contain" cachePolicy="memory-disk" recyclingKey={imageId} onError={()=>setFailed(true)}/>
    : <Ionicons name={icon} size={19} color="#FFCD00"/>;
}
export function ManagedHomeSections({
  sections,products,bestSellerProductIds,campaigns,reels,now,signedIn,
  renderProduct,onRefresh,onOpenScanner,onRoute,onBrand,
}:Props) {
  const {palette}=useAppearance();
  // All product lookups use the currently visible catalog; a recipient-only
  // or unavailable product cannot leak through a curated admin ID.
  const own=products.filter(p=>!p.marketplace);
  const productById=new Map(own.map(p=>[String(p.id),p]));
  const liveCampaigns=campaigns.filter(c=>Date.parse(c.ends_at)>now);
  const brandOptions=[...new Set(own.map(p=>String(p.brand||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr-TR'));
  return <>
    {sections.filter(section=>section.enabled).map(section=>{
      const title=section.title||section.id;
      switch(section.id){
        case 'actions':
          return <View key={section.id} style={styles.actions}>
              {shortActionItems.map(action=><Pressable key={action.id}
                accessibilityRole="button" accessibilityLabel={action.label}
                style={({pressed})=>[styles.actionCard,pressed&&{opacity:0.8}]}
                onPress={()=>action.id==='scan'?onOpenScanner():onRoute(!signedIn&&action.id==='orders'?'/login':action.route)}>
                <View style={styles.actionTop}>
                  <View style={styles.actionIconSlot}>
                    <QuickActionIcon key={section.actionImageIds?.[action.id]||action.id} imageId={section.actionImageIds?.[action.id]} icon={action.icon}/>
                  </View>
                  <View style={styles.actionArrowSlot}>
                    <Ionicons name="chevron-forward" size={12} color="#FFCD00"/>
                  </View>
                </View>
                <View style={styles.actionTextBlock}>
                  <Text style={styles.actionTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{action.label}</Text>
                  <Text style={styles.actionSubtitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{action.subtitle}</Text>
                </View>
              </Pressable>)}
          </View>;
        case 'flash': {
          const rows=liveCampaigns.map(campaign=>{
            const ids=new Set((campaign.product_ids||[]).map(String));
            const offers=own.filter(p=>ids.has(String(p.id))&&p.timed_campaign_id===campaign.id);
            return {campaign,offers};
          }).filter(row=>row.offers.length);
          if(!rows.length)return null;
          return <View key={section.id} style={[styles.section,styles.flashShell]}>
            <SectionHead icon="flash" title={title} action="Tümünü Gör" onAction={()=>onRoute('/campaigns')}/>
            {rows.slice(0,2).map(({campaign,offers})=><View key={campaign.id} style={styles.flashCampaign}>
              <Text style={styles.campaignLabel}>{campaign.title}</Text>
              <TimedCampaignNotice endAt={campaign.ends_at} title="Fırsatın bitmesine"
                stock={offers.reduce((sum,p)=>sum+Math.floor(Math.max(0,Number(p.stock)||0)/Math.max(1,Number(p.units_per_box)||1)),0)}
                unitsPerBox={1} onExpire={onRefresh}/>
              <ItemStrip products={offers.slice(0,8)} renderProduct={renderProduct}/>
            </View>)}
          </View>;
        }
        case 'special': {
          const selected=section.productIds.length
            ? section.productIds.map(id=>productById.get(id)).filter((p):p is B2BProduct=>Boolean(p))
            : own.filter(p=>{
              const price=Number(p.price),oldPrice=Number(p.original_price);
              return Number.isFinite(price)&&price>0&&Number.isFinite(oldPrice)&&
                oldPrice>price&&(Number(p.stock)||0)>0;
            }).sort((a,b)=>
              (1-Number(b.price)/Number(b.original_price))-(1-Number(a.price)/Number(a.original_price))
            );
          if(!selected.length)return null;
          return <View key={section.id} style={styles.section}>
            <SectionHead icon="pricetag" title={title}/>
            <ItemStrip products={selected.slice(0,12)} renderProduct={renderProduct}/>
          </View>;
        }
        case 'reorder':
          if(!signedIn)return null;
          return <Pressable key={section.id} accessibilityRole="button"
            onPress={()=>onRoute('/my-orders')} style={styles.reorder}>
            <View style={styles.parcelIcon}><Ionicons name="cube" size={29} color="#FFCD00"/></View>
            <View style={{flex:1,minWidth:0}}>
              <Text style={styles.reorderTitle}>{title}</Text>
              <Text style={styles.reorderDescription}>Önceki siparişlerini görüntüle ve yeniden sipariş ver</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#FFCD00"/>
          </Pressable>;
        case 'videos':
          if(!reels.length)return null;
          return <View key={section.id} style={styles.section}>
            <SectionHead icon="play-circle-outline" title={title}
              action="Tümünü Gör" onAction={()=>onRoute('/(tabs)/discover')}/>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productScroll}>
              {reels.slice(0,8).map(reel=><Pressable key={String(reel.id)} style={styles.videoCard}
                accessibilityLabel={reel.title||'Ürün videosu'} accessibilityRole="button"
                onPress={()=>onRoute('/(tabs)/discover')}>
                {absoluteMediaUrl(reel.thumbnail_url) ?
                  <Image source={{uri:absoluteMediaUrl(reel.thumbnail_url)!}}
                    contentFit="cover" style={StyleSheet.absoluteFillObject}/>
                  : absoluteMediaUrl(reel.video_url) ?
                    <Video source={{uri:absoluteMediaUrl(reel.video_url)!}}
                      style={StyleSheet.absoluteFillObject} resizeMode={ResizeMode.COVER}
                      isMuted shouldPlay={false} useNativeControls={false}/>
                  : <Ionicons name="videocam-outline" size={42} color="#FFFFFF"/>}
                <View style={styles.videoLabel}>
                  <Ionicons name="play-circle" color="#FFCD00" size={29}/>
                  <Text style={styles.videoTitle} numberOfLines={2}>{reel.title||'Ürün videosu'}</Text>
                </View>
              </Pressable>)}
            </ScrollView>
          </View>;
        case 'bestsellers': {
          const ranked=bestSellerProductIds.map(id=>productById.get(id)).filter((p):p is B2BProduct=>Boolean(p));
          if(!ranked.length)return null;
          return <View key={section.id} style={styles.section}>
            <SectionHead icon="flame" title={title}/>
            <ItemStrip products={ranked.slice(0,12)} renderProduct={renderProduct}/>
          </View>;
        }
        case 'brands': {
          const allowed=section.brands.length?section.brands:brandOptions;
          const available=new Set(brandOptions.map(x=>x.toLocaleLowerCase('tr-TR')));
          const brands=allowed.filter(x=>available.has(x.toLocaleLowerCase('tr-TR'))).slice(0,24);
          if(!brands.length)return null;
          return <View key={section.id} style={styles.section}>
            <SectionHead icon="ribbon-outline" title={title}/>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productScroll}>
              {brands.map(brand=><Pressable key={brand} accessibilityRole="button"
                accessibilityLabel={brand+' ürünlerini göster'} style={[styles.brandTile,{backgroundColor:palette.surface,borderColor:palette.border}]}
                onPress={()=>onBrand(brand)}>
                {section.brandImageIds?.[brand] && homepageMediaUrl(section.brandImageIds[brand])
                  ? <Image source={{uri:homepageMediaUrl(section.brandImageIds[brand])!}}
                      style={styles.brandImage} contentFit="contain" cachePolicy="memory-disk"/>
                  : <Text style={[styles.brandName,{color:palette.text}]} numberOfLines={2}>{brand}</Text>}
              </Pressable>)}
            </ScrollView>
          </View>;
        }
        default:return null;
      }
    })}
  </>;
}

const styles=StyleSheet.create({
  section:{marginTop:18,gap:10},
  head:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  headLeft:{flexDirection:'row',alignItems:'center',gap:8,flex:1,minWidth:0},
  heading:{fontSize:19,fontWeight:'900',color:'#F8F8FA',flexShrink:1},
  seeAll:{flexDirection:'row',alignItems:'center',gap:2,minHeight:38},
  seeAllText:{fontSize:11,color:'#E5E7EB',fontWeight:'700'},
  productScroll:{gap:10,paddingRight:14},
  actions:{width:'100%',alignSelf:'center',flexDirection:'row',flexWrap:'nowrap',alignItems:'stretch',gap:4,marginTop:6,paddingBottom:3},
  actionCard:{flexGrow:1,flexShrink:1,flexBasis:0,minWidth:0,height:62,borderRadius:10,borderWidth:1,borderColor:'#6A5C33',
    borderTopColor:'#B5A05B',borderBottomColor:'#3B3628',backgroundColor:'#252526',
    paddingHorizontal:4,paddingVertical:5,justifyContent:'space-between',
    shadowColor:'#FFCD00',shadowOpacity:0.12,shadowRadius:3,shadowOffset:{width:0,height:1},elevation:2},
  actionTop:{height:22,flexDirection:'row',alignItems:'center',justifyContent:'space-between',width:'100%'},
  actionIconSlot:{width:22,height:22,alignItems:'center',justifyContent:'center'},
  actionArrowSlot:{width:12,height:22,alignItems:'center',justifyContent:'center'},
  actionIcon:{width:22,height:22},
  actionTextBlock:{height:26,width:'100%',justifyContent:'space-between',alignItems:'center'},
  actionTitle:{width:'100%',height:14,fontSize:10,lineHeight:14,fontWeight:'500',color:'#FFFFFF',textAlign:'center',includeFontPadding:false},
  actionSubtitle:{width:'100%',height:11,fontSize:9,color:'#DDDDDF',lineHeight:11,fontWeight:'400',textAlign:'center',includeFontPadding:false},
  flashShell:{padding:12,borderColor:'#BE9012',borderWidth:1,borderRadius:19,backgroundColor:'#151516'},
  flashCampaign:{gap:9},
  campaignLabel:{color:'#FFD447',fontWeight:'800',fontSize:13},
  reorder:{marginTop:15,minHeight:90,padding:13,flexDirection:'row',alignItems:'center',
    backgroundColor:'#1D1C19',borderColor:'#DEAF22',borderWidth:1.5,borderRadius:17,gap:12},
  parcelIcon:{width:52,height:54,alignItems:'center',justifyContent:'center',borderRadius:13,
    backgroundColor:'#3E3313'},
  reorderTitle:{color:'#FFFFFF',fontSize:17,fontWeight:'900'},
  reorderDescription:{color:'#E1D7B5',fontSize:11,marginTop:5,lineHeight:16},
  videoCard:{width:140,height:175,borderRadius:15,borderWidth:1,borderColor:'#655528',
    backgroundColor:'#262628',overflow:'hidden',justifyContent:'flex-end',alignItems:'center'},
  videoLabel:{padding:9,width:'100%',backgroundColor:'rgba(0,0,0,0.6)',gap:3},
  videoTitle:{fontSize:11,color:'#FFF',fontWeight:'800'},
  brandTile:{width:132,minHeight:61,borderRadius:14,borderWidth:1.2,paddingHorizontal:7,
    alignItems:'center',justifyContent:'center'},
  brandImage:{width:116,height:46},
  brandName:{fontSize:15,fontWeight:'900',textAlign:'center'},
});
