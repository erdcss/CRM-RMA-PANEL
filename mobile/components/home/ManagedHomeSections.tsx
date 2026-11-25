import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { spacing } from '@/constants/theme';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { absoluteMediaUrl, homepageMediaUrl, type B2BProduct, type B2BReel, type B2BTimedCampaign, type HomeSection } from '@/lib/api';
import { FlashHomeSection } from '@/components/home/FlashHomeSection';

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
const shortActionItems: Array<{id:'scan'|'orders'|'ledger'|'campaigns';label:string;subtitle:string;compactSubtitle:string;icon:keyof typeof Ionicons.glyphMap;route:string}> = [
  {id:'scan',label:'Hızlı Sipariş',subtitle:'Toplu ürün al',compactSubtitle:'Toplu ürün al',icon:'flash',route:''},
  {id:'orders',label:'Tekrar Sipariş',subtitle:'Önceki siparişini yenile',compactSubtitle:'Siparişi yenile',icon:'repeat-outline',route:'/my-orders'},
  {id:'ledger',label:'Cari Hesap',subtitle:'Bakiye ve limit bilgisi',compactSubtitle:'Bakiye ve limit',icon:'cash-outline',route:'/ledger'},
  {id:'campaigns',label:'Kampanyalar',subtitle:'Güncel fırsatları gör',compactSubtitle:'Fırsatları gör',icon:'pricetag-outline',route:'/campaigns'},
];
function QuickActionIcon({imageId,icon,size}:{imageId?:string;icon:keyof typeof Ionicons.glyphMap;size:number}){
  const [failed,setFailed]=useState(false);
  const uri=homepageMediaUrl(imageId);
  return uri&&!failed
    ? <Image source={{uri}} style={[styles.actionIcon,{width:size,height:size}]} contentFit="contain" cachePolicy="memory-disk" priority="high" recyclingKey={imageId} onError={()=>setFailed(true)}/>
    : <Ionicons name={icon} size={size} color="#FFCD00"/>;
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
function reelDuration(seconds: number | null | undefined) {
  if(typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<=0)return '';
  const total=Math.floor(seconds);
  return Math.floor(total/60)+':'+String(total%60).padStart(2,'0');
}

function MiniReelCard({reel,width,onPress}:{reel:B2BReel;width:number;onPress:()=>void}){
  const [loadedDuration,setLoadedDuration]=useState<number>();
  const [thumbnailFailed,setThumbnailFailed]=useState(false);
  const thumbnail=absoluteMediaUrl(reel.thumbnail_url);
  const video=absoluteMediaUrl(reel.video_url);
  const duration=reelDuration(reel.duration_seconds??loadedDuration);
  return <Pressable style={[styles.videoCard,{width}]} accessibilityRole="button"
    accessibilityLabel={reel.title||'Ürün videosu'} onPress={onPress}>
    {thumbnail&&!thumbnailFailed ?
      <Image source={{uri:thumbnail}} contentFit="cover" style={StyleSheet.absoluteFillObject}
        cachePolicy="memory-disk" recyclingKey={String(reel.id)} onError={()=>setThumbnailFailed(true)}/>
      :video?<Video source={{uri:video}} style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER} isMuted shouldPlay={false} useNativeControls={false}
        onLoad={status=>{if(status.isLoaded&&status.durationMillis)setLoadedDuration(status.durationMillis/1000);}}/>
      :<Ionicons name="videocam-outline" size={18} color="#D4D4D4"/>}
    <View pointerEvents="none" style={styles.videoPlay}>
      <Ionicons name="play" size={12} color="#FFFFFF"/>
    </View>
    <View pointerEvents="none" style={styles.videoLabel}>
      <Text style={styles.videoTitle} numberOfLines={2}>{reel.title||'Ürün videosu'}</Text>
      {duration?<Text style={styles.videoDuration}>{duration}</Text>:null}
    </View>
  </Pressable>;
}
function CompactReelsStrip({title,reels,onRoute}:{title:string;reels:B2BReel[];onRoute:Props['onRoute']}){
  const [stripWidth,setStripWidth]=useState(0);
  const cardWidth=stripWidth?Math.max(42,Math.floor((stripWidth-3*4)/4)):60;
  return <View style={styles.videoSection}>
    <Pressable style={styles.videoIntro} onPress={()=>onRoute('/(tabs)/discover')}
      accessibilityRole="button" accessibilityLabel={title+', tüm videoları keşfet'}>
      <View style={styles.videoHeadingRow}>
        <Ionicons name="film-outline" size={16} color="#FFCD00"/>
        <Text style={styles.videoHeading} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{title}</Text>
      </View>
      <Text style={styles.videoDescription} numberOfLines={3}>Ürünleri yakından gör, işletmen için en doğru seçimi yap.</Text>
    </Pressable>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.videoScroll}
      onLayout={event=>setStripWidth(event.nativeEvent.layout.width)}
      contentContainerStyle={styles.videoStripContent}>
      {reels.slice(0,8).map(reel=><MiniReelCard key={String(reel.id)} reel={reel} width={cardWidth}
        onPress={()=>onRoute('/(tabs)/discover?reelId='+encodeURIComponent(String(reel.id)))}/>)}
    </ScrollView>
  </View>;
}
// Admin-pinned brands remain visible even if no matching product is currently
// available. Normalize spelling only for deduplication; retain admin labels/order.
function brandKey(value:string){
  return value.trim().toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
}
function BrandLogoTile({brand,imageId,width,onPress}:{brand:string;imageId?:string;width:number;onPress:()=>void}){
  const [failed,setFailed]=useState(false);
  const uri=homepageMediaUrl(imageId);
  return <Pressable accessibilityRole="button" accessibilityLabel={brand+' ürünlerini göster'}
    style={[styles.brandTile,{width}]} onPress={onPress}>
    {uri&&!failed?<Image source={{uri}} style={styles.brandImage} contentFit="contain"
      cachePolicy="memory-disk" recyclingKey={imageId} onError={()=>setFailed(true)}/>
      :<Text style={styles.brandName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{brand}</Text>}
  </Pressable>;
}
function CompactBrandStrip({title,section,brandOptions,onBrand}:{title:string;section:HomeSection;brandOptions:string[];onBrand:Props['onBrand']}){
  const [expanded,setExpanded]=useState(false);
  const [viewport,setViewport]=useState(0);
  const source=section.brands.length?section.brands:brandOptions;
  const configuredImages=section.brandImageIds||{};
  const seen=new Set<string>();
  const brands=source.map(brand=>brand.trim()).filter(brand=>{
    const key=brandKey(brand);
    if(!key||seen.has(key))return false;
    seen.add(key);return true;
  }).slice(0,24);
  const imageFor=(brand:string)=>configuredImages[brand]||Object.entries(configuredImages)
    .find(([name,id])=>Boolean(id)&&brandKey(name)===brandKey(brand))?.[1];
  const tileWidth=viewport?Math.max(36,Math.floor((viewport-5*4)/6)):56;
  const tiles=brands.map(brand=>{
    const imageId=imageFor(brand);
    return <BrandLogoTile key={brandKey(brand)+':'+(imageId||'')} brand={brand} imageId={imageId}
      width={tileWidth} onPress={()=>onBrand(brand)}/>;
  });
  if(!brands.length)return null;
  return <View style={styles.brandSection}>
    <View style={styles.brandHeader}>
      <View style={styles.brandHeadingRow}>
        <Ionicons name="pricetag-outline" size={19} color="#FFCD00"/>
        <Text style={styles.brandHeading} numberOfLines={1}>{title}</Text>
      </View>
      <Pressable style={styles.brandAll} accessibilityRole="button"
        accessibilityState={{expanded}} onPress={()=>setExpanded(value=>!value)}>
        <Text style={styles.brandAllText}>{expanded?'Daha Az':'Tüm Markalar'}</Text>
        <Ionicons name={expanded?'chevron-up':'chevron-forward'} size={12} color="#FFCD00"/>
      </Pressable>
    </View>
    <View style={styles.brandViewport} onLayout={event=>setViewport(event.nativeEvent.layout.width)}>
      {expanded?<View style={styles.brandGrid}>{tiles}</View>:
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brandScroll}>{tiles}</ScrollView>}
    </View>
  </View>;
}
export function ManagedHomeSections({
  sections,products,bestSellerProductIds,campaigns,reels,now,signedIn,
  renderProduct,onRefresh,onOpenScanner,onRoute,onBrand,
}:Props) {
  const {width:windowWidth}=useWindowDimensions();
  const [actionViewport,setActionViewport]=useState(0);
  const actionWidth=actionViewport||Math.max(1,windowWidth-2*spacing.lg);
  // Always fit all four shortcuts in one row. Scale the horizontal card
  // internals on phone widths and let the copy wrap without truncation.
  const actionColumns=4;
  const actionTileWidth=Math.max(0,Math.floor((actionWidth-(actionColumns-1)*4)/actionColumns));
  // Slim reference cards: compact artwork, concise copy and one row.
  const compactActions=actionTileWidth<148;
  const actionIconSize=Math.max(14,Math.min(36,Math.round(actionTileWidth*0.22)));
  const actionCardHeight=Math.max(44,Math.min(64,Math.round(actionTileWidth/3.4)));
  const actionTitleSize=Math.max(7.5,Math.min(15,actionTileWidth*0.09));
  const actionSubtitleSize=Math.max(6.5,Math.min(12,actionTileWidth*0.073));
  const actionChevronSize=Math.max(9,Math.min(18,Math.round(actionTileWidth*0.10)));
  // All product lookups use the currently visible catalog; a recipient-only
  // or unavailable product cannot leak through a curated admin ID.
  const own=products.filter(p=>!p.marketplace);
  const productById=new Map(own.map(p=>[String(p.id),p]));
  const brandOptions=[...new Set(own.map(p=>String(p.brand||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr-TR'));
  const orderedSections=sections.filter(section=>section.id!=='flash'&&section.id!=='special');
  const actionIndex=orderedSections.findIndex(section=>section.id==='actions');
  orderedSections.splice(actionIndex+1,0,...(['flash','special'] as const).flatMap(id=>sections.filter(section=>section.id===id)));
  return <>
    {orderedSections.filter(section=>section.enabled).map(section=>{
      const title=section.title||section.id;
      switch(section.id){
        case 'actions':
          return <View key={section.id} style={styles.actions}
            onLayout={event=>setActionViewport(event.nativeEvent.layout.width)}>
              {shortActionItems.map(action=><Pressable key={action.id}
                accessibilityRole="button" accessibilityLabel={action.label}
                accessibilityHint={action.subtitle}
                style={({pressed})=>[styles.actionCard,compactActions&&styles.actionCardCompact,{width:actionTileWidth,minHeight:actionCardHeight},pressed&&{opacity:0.8}]}
                onPress={()=>action.id==='scan'?onOpenScanner():onRoute(!signedIn&&action.id==='orders'?'/login':action.route)}>
                <View style={[styles.actionIconSlot,{width:actionIconSize,height:actionIconSize}]}>
                  <QuickActionIcon key={section.actionImageIds?.[action.id]||action.id} imageId={section.actionImageIds?.[action.id]} icon={action.icon} size={actionIconSize}/>
                </View>
                <View style={styles.actionCopy}>
                  <Text style={[styles.actionTitle,{fontSize:actionTitleSize,lineHeight:Math.ceil(actionTitleSize*1.14)}]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{action.label}</Text>
                  <Text style={[styles.actionSubtitle,{fontSize:actionSubtitleSize,lineHeight:Math.ceil(actionSubtitleSize*1.18)}]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>{actionTileWidth<110?action.compactSubtitle:action.subtitle}</Text>
                </View>
                <View pointerEvents="none" style={[styles.actionArrow,{width:Math.ceil(actionChevronSize*0.7),height:actionChevronSize}]}>
                  <Ionicons name="chevron-forward" size={actionChevronSize} color="#FFCD00"/>
                </View>
              </Pressable>)}
          </View>;
        case 'flash':
          return <FlashHomeSection key={section.id} title={title} imageId={section.flashBannerImageId}
            campaigns={campaigns} products={own} signedIn={signedIn}
            onRefresh={onRefresh} onRoute={onRoute}/>;
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
          return <CompactReelsStrip key={section.id} title={title} reels={reels} onRoute={onRoute}/>;
        case 'bestsellers': {
          const ranked=bestSellerProductIds.map(id=>productById.get(id)).filter((p):p is B2BProduct=>Boolean(p));
          if(!ranked.length)return null;
          return <View key={section.id} style={styles.section}>
            <SectionHead icon="flame" title={title}/>
            <ItemStrip products={ranked.slice(0,12)} renderProduct={renderProduct}/>
          </View>;
        }
        case 'brands':
          return <CompactBrandStrip key={section.id} title={title} section={section}
            brandOptions={brandOptions} onBrand={onBrand}/>;
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
  actionCard:{flexDirection:'row',alignItems:'center',flexShrink:0,minWidth:0,borderRadius:8,borderWidth:1,borderColor:'#DCA51B',
    backgroundColor:'#171717',paddingHorizontal:5,paddingVertical:3,gap:3},
  actionIconSlot:{alignItems:'center',justifyContent:'center',flexShrink:0},
  actionIcon:{alignSelf:'center'},
  actionCardCompact:{paddingHorizontal:2,paddingVertical:2,gap:1,borderRadius:6},
  actionCopy:{flex:1,minWidth:0,justifyContent:'center',gap:1},
  actionTitle:{width:'100%',minWidth:0,fontWeight:'700',color:'#FFFFFF',includeFontPadding:false},
  actionSubtitle:{width:'100%',fontWeight:'400',color:'#D1D1D1',includeFontPadding:false,textAlign:'left'},
  actionArrow:{flexShrink:0,alignItems:'center',justifyContent:'center'},
  reorder:{marginTop:10,width:'100%',aspectRatio:12,paddingHorizontal:7,flexDirection:'row',alignItems:'center',
     backgroundColor:'#1D1C19',borderColor:'#DEAF22',borderWidth:1,borderRadius:7,gap:6,overflow:'hidden'},
   reorderImageFrame:{paddingHorizontal:0,borderWidth:0,backgroundColor:'transparent'},
   reorderTitle:{color:'#FFFFFF',fontSize:11,fontWeight:'700',lineHeight:12},
   reorderDescription:{color:'#E1D7B5',fontSize:8,lineHeight:10},
   reorderCta:{flexDirection:'row',alignItems:'center',gap:2,borderRadius:5,backgroundColor:'#FFCD00',paddingHorizontal:5,paddingVertical:3},
   reorderCtaText:{fontSize:8,fontWeight:'700',color:'#161616'},
  videoSection:{marginTop:10,width:'100%',flexDirection:'row',alignItems:'center',gap:6,padding:4,borderRadius:9,borderWidth:1,borderColor:'#403B2D',backgroundColor:'#171717'},
  videoIntro:{width:'31%',flexShrink:0,minWidth:0,gap:3,paddingLeft:3},
  videoHeadingRow:{flexDirection:'row',alignItems:'center',gap:3,minWidth:0},
  videoHeading:{fontSize:11,lineHeight:15,fontWeight:'400',color:'#FFCD00',flex:1,minWidth:0},
  videoDescription:{fontSize:8,lineHeight:11,fontWeight:'400',color:'#E5E5E5'},
  videoScroll:{flex:1,minWidth:0},
  videoStripContent:{flexDirection:'row',alignItems:'center',gap:4},
  videoCard:{height:54,borderRadius:6,borderWidth:1,borderColor:'#887751',backgroundColor:'#262628',overflow:'hidden',justifyContent:'center',alignItems:'center'},
  videoPlay:{position:'absolute',top:10,alignSelf:'center',width:19,height:19,borderRadius:10,backgroundColor:'rgba(0,0,0,0.50)',alignItems:'center',justifyContent:'center'},
  videoLabel:{position:'absolute',left:0,right:0,bottom:0,paddingHorizontal:3,paddingVertical:2,backgroundColor:'rgba(0,0,0,0.68)',minHeight:20},
  videoTitle:{fontSize:7,lineHeight:9,color:'#FFFFFF',fontWeight:'400'},
  videoDuration:{fontSize:7,lineHeight:8,color:'#FFFFFF',textAlign:'right',fontWeight:'400'},
  brandSection:{marginTop:10,width:'100%',gap:4},
  brandHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:6},
  brandHeadingRow:{flexDirection:'row',alignItems:'center',gap:6,flex:1,minWidth:0},
  brandHeading:{fontSize:14,lineHeight:20,fontWeight:'400',color:'#FFFFFF',flexShrink:1},
  brandAll:{flexDirection:'row',alignItems:'center',gap:2,minHeight:24},
  brandAllText:{fontSize:10,lineHeight:14,fontWeight:'400',color:'#E5E5E5'},
  brandViewport:{width:'100%'},
  brandScroll:{flexDirection:'row',alignItems:'center',gap:4},
  brandGrid:{flexDirection:'row',flexWrap:'wrap',gap:4},
  brandTile:{height:28,borderRadius:6,borderWidth:1,borderColor:'#E5E5E5',backgroundColor:'#FFFFFF',paddingHorizontal:3,
    overflow:'hidden',alignItems:'center',justifyContent:'center',flexShrink:0},
  brandImage:{width:'100%',height:'100%'},
  brandName:{fontSize:10,lineHeight:14,fontWeight:'400',color:'#222222',textAlign:'center'},
});
