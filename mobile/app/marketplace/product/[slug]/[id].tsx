import { Redirect, useLocalSearchParams } from 'expo-router';

/** Legacy marketplace deep links now share the standard B2B product detail layout. */
export default function MarketplaceLegacyProduct() {
  const {slug,id}=useLocalSearchParams<{slug:string;id:string}>();
  return <Redirect href={{pathname:'/product/[id]',params:{id:'mp-'+String(id),slug:String(slug)}} as never}/>;
}
