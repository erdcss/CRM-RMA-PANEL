import { Linking } from 'react-native';
import type { Router } from 'expo-router';
import {resolveB2BNotificationLink} from './notification-link';

/** Navigate only after a target passes the same-origin allowlist. */
export async function openB2BNotificationTarget(router:Router,raw:unknown):Promise<boolean> {
  const destination=resolveB2BNotificationLink(raw);
  if(!destination)return false;
  switch(destination.kind){
    case 'product':
      router.push({pathname:'/product/[id]',params:{id:destination.id}} as never);
      return true;
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
