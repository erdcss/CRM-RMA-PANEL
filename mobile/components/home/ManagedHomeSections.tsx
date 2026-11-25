import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/constants/theme';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
  renderProduct: (item: B2BProduct, viewportWidth?: number) => ReactNode;
  onRefresh: () => void;
  onOpenScanner: () => void;
  onRoute: (path: string) => void;
  onBrand: (name: string) => void;
};
function SectionHead({icon,title,action,onAction}:{icon:keyof typeof Ionicons.glyphMap;title:string;action?:string;onAction?:()=>void}) {
  return <View style={styles.head}>
    <View style={styles.headLeft}>
      {icon === "pricetag" ? <MaterialCommunityIcons name="sale" size={23} color="#FFCD00"/> : <Ionicons name={icon} size={23} color="#FFCD00" />}
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
  const [viewport,setViewport]=useState(0);
  return <ScrollView horizontal showsHorizontalScrollIndicator={false}
    onLayout={event=>setViewport(event.nativeEvent.layout.width)}
    contentContainerStyle={styles.productScroll}>
    {products.map(product=>renderProduct(product,viewport||undefined))}
  </ScrollView>;
}
const shortActionItems: Array<{id:'scan'|'orders'|'ledger'|'campaigns';label:string;subtitle:string;icon:keyof typeof Ionicons.glyphMap;route:string}> = [
  {id:'scan',label:'Hızlı Sipariş',subtitle:'Barkodla veya\nlisteyle toplu alım',icon:'flash',route:''},
  {id:'orders',label:'Tekrar Sipariş',subtitle:'Önceki siparişini\nhızla yenile',icon:'repeat-outline',route:'/my-orders'},
  {id:'ledger',label:'Cari Hesap',subtitle:'Bakiye, limit ve\nekstre bilgilerin',icon:'cash-outline',route:'/ledger'},
  {id:'campaigns',label:'Kampanyalar',subtitle:'Toptan avantajlı\nfırsatları kaçırma',icon:'pricetag-outline',route:'/campaigns'},
];
function QuickActionIcon({imageId,icon}:{imageId?:string;icon:keyof typeof Ionicons.glyphMap}){
  const [failed,setFailed]=useState(false);
  const uri=homepageMediaUrl(imageId);
  return uri&&!failed
    ? <Image source={{uri}} style={styles.actionIcon} contentFit="contain" cachePolicy="memory-disk" recyclingKey={imageId} onError={()=>setFailed(true)}/>
    : <Ionicons name={icon} size={17} color="#FFCD00"/>;
}
function ReorderBanner({imageId,title,onPress}:{imageId?:string;title:string;onPress:()=>void}){
  const [failed,setFailed]=useState(false);
  const [imageRatio,setImageRatio]=useState(12);
  const uri=homepageMediaUrl(imageId);
  const showImage=!!uri&&!failed;
  return <Pressable accessibilityRole="button" accessibilityLabel={title+', Siparişlerimi Gör'}
    onPress={onPress} style={[styles.reorder,showImage&&styles.reorderImageFrame,showImage&&{aspectRatio:imageRatio}]}>
    {showImage ? <Image source={{uri}} style={StyleSheet.absoluteFill} contentFit="contain"
      cachePolicy="memory-disk" recyclingKey={imageId}
      onLoad={({source})=>{if(Number.isFinite(source.width)&&Number.isFinite(source.height)&&source.width>0&&source.height>0)setImageRatio(source.width/source.height);}}
      onError={()=>setFailed(true)}/>
    : <>
      <Ionicons name="cube" size={21} color="#FFCD00"/>
      <View style={{flex:1,minWidth:0}}>
        <Text style={styles.reorderTitle} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
        <Text style={styles.reorderDescription} numberOfLines={1}>Önceki siparişlerini kolayca yenile</Text>
      </View>
      <View style={styles.reorderCta}><Text style={styles.reorderCtaText} numberOfLines={1}>Siparişlerimi Gör</Text><Ionicons name="chevron-forward" size={11} color="#161616"/></View>
    </>}
  </Pressable>;
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
                accessibilityHint={action.subtitle}
                style={({pressed})=>[styles.actionCard,pressed&&{opacity:0.8}]}
                onPress={()=>action.id==='scan'?onOpenScanner():onRoute(!signedIn&&action.id==='orders'?'/login':action.route)}>
                <View style={styles.actionTop}>
                  <View style={styles.actionIconSlot}>
                    <QuickActionIcon key={section.actionImageIds?.[action.id]||action.id} imageId={section.actionImageIds?.[action.id]} icon={action.icon}/>
                  </View>
                  <Text style={styles.actionTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{action.label}</Text>
                </View>
                <Text style={styles.actionSubtitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>{action.subtitle}</Text>
                <View pointerEvents="none" style={styles.actionArrow}>
                  <Ionicons name="chevron-forward" size={11} color="#FFCD00"/>
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
          return <ReorderBanner key={section.reorderBannerImageId||section.id} imageId={section.reorderBannerImageId}
            title={title} onPress={()=>onRoute('/my-orders')}/>;
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
  heading:{fontSize:15,fontWeight:'500',color:'#F8F8FA',flexShrink:1},
  seeAll:{flexDirection:'row',alignItems:'center',gap:2,minHeight:38},
  seeAllText:{fontSize:11,color:'#E5E7EB',fontWeight:'400'},
  productScroll:{gap:spacing.sm,paddingRight:14},
  actions:{width:'100%',alignSelf:'center',flexDirection:'row',flexWrap:'nowrap',alignItems:'stretch',gap:4,marginTop:4,paddingBottom:3},
  actionCard:{flexGrow:1,flexShrink:1,flexBasis:0,minWidth:0,height:64,borderRadius:10,borderWidth:1,borderColor:'#6A5C33',
    borderTopColor:'#B5A05B',borderBottomColor:'#3B3628',backgroundColor:'#252526',
    paddingHorizontal:4,paddingVertical:5,justifyContent:'space-between',
    shadowColor:'#FFCD00',shadowOpacity:0.10,shadowRadius:3,shadowOffset:{width:0,height:1},elevation:2},
  actionTop:{flexDirection:'row',alignItems:'center',gap:2,minWidth:0,minHeight:17},
  actionIconSlot:{width:15,height:17,alignItems:'center',justifyContent:'center',flexShrink:0},
  actionIcon:{width:15,height:15},
  actionTitle:{flex:1,minWidth:0,fontSize:9.5,lineHeight:13,fontWeight:'400',color:'#FFFFFF',includeFontPadding:false},
  actionSubtitle:{width:'100%',fontSize:8,lineHeight:10,fontWeight:'300',color:'#E0E0E0',includeFontPadding:false,textAlign:'left'},
  actionArrow:{position:'absolute',right:2,top:26,width:12,height:12,alignItems:'center',justifyContent:'center'},
  flashShell:{padding:12,borderColor:'#BE9012',borderWidth:1,borderRadius:19,backgroundColor:'#151516'},
  flashCampaign:{gap:9},
  campaignLabel:{color:'#FFD447',fontWeight:'500',fontSize:13},
  reorder:{marginTop:10,width:'100%',aspectRatio:12,paddingHorizontal:7,flexDirection:'row',alignItems:'center',
     backgroundColor:'#1D1C19',borderColor:'#DEAF22',borderWidth:1,borderRadius:7,gap:6,overflow:'hidden'},
   reorderImageFrame:{paddingHorizontal:0,borderWidth:0,backgroundColor:'transparent'},
   reorderTitle:{color:'#FFFFFF',fontSize:11,fontWeight:'700',lineHeight:12},
   reorderDescription:{color:'#E1D7B5',fontSize:8,lineHeight:10},
   reorderCta:{flexDirection:'row',alignItems:'center',gap:2,borderRadius:5,backgroundColor:'#FFCD00',paddingHorizontal:5,paddingVertical:3},
   reorderCtaText:{fontSize:8,fontWeight:'700',color:'#161616'},
  videoCard:{width:140,height:175,borderRadius:15,borderWidth:1,borderColor:'#655528',
    backgroundColor:'#262628',overflow:'hidden',justifyContent:'flex-end',alignItems:'center'},
  videoLabel:{padding:9,width:'100%',backgroundColor:'rgba(0,0,0,0.6)',gap:3},
  videoTitle:{fontSize:11,color:'#FFF',fontWeight:'800'},
  brandTile:{width:132,minHeight:61,borderRadius:14,borderWidth:1.2,paddingHorizontal:7,
    alignItems:'center',justifyContent:'center'},
  brandImage:{width:116,height:46},
  brandName:{fontSize:15,fontWeight:'900',textAlign:'center'},
});
