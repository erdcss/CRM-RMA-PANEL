import { Linking } from 'react-native';
import type { Router } from 'expo-router';
import {resolveB2BNotificationLink} from './notification-link';
import {rmaApi} from './api';

/** Navigate only after a target passes the same-origin allowlist. */
export async function openB2BNotificationTarget(router:Router,raw:unknown):Promise<boolean> {
  const destination=resolveB2BNotificationLink(raw);
  if(!destination)return false;
  switch(destination.kind){
    case 'product': {
      // Supplier products require a store slug to load in the native detail page.
      // They have a separate mp- ID namespace and cannot be fetched as B2B stock.
      if(destination.id.startsWith('mp-')){
        try{
          const supplierProducts=await rmaApi.listMarketplaceProducts();
          const product=supplierProducts.find(x=>String(x.id)===destination.id.slice(3));
          if(product?.seller_slug){
            router.push({pathname:'/product/[id]',params:{
              id:destination.id,slug:product.seller_slug,
            }} as never);
            return true;
          }
        }catch{/* Keep notification usable when marketplace data is unavailable. */}
        await Linking.openURL('https://b2b.ecalisgan.com/urun/'+encodeURIComponent(destination.id));
        return true;
      }
      router.push({pathname:'/product/[id]',params:{id:destination.id}} as never);
      return true;
    }
    case 'category':
      router.push({pathname:'/collection/[category]',params:{category:destination.category}} as never);
      return true;
    case 'store':
      router.push({pathname:'/marketplace/store/[slug]',params:{slug:destination.slug}} as never);
      return true;
    case 'route':
      router.push(destination.path as never);
      return true;
    case 'web':
      await Linking.openURL(destination.url);
      return true;
  }
}
