import React,{useEffect,useMemo,useState} from "react";
import {Image,View} from "react-native";
import {Package} from "lucide-react-native";
import {productImageSource,type ProductPicture} from "./product-images";

export function ProductThumbnail({item,storeId,token,size=60}:{
  item:ProductPicture;storeId:number|string;token:string;size?:number;
}){
  const [failed,setFailed]=useState(false);
  const source=useMemo(()=>productImageSource(item,storeId,token),
    [item.id,item.image_url,item.image_external_url,item.image_count,storeId,token]);
  useEffect(()=>setFailed(false),[source?.uri]);
  return <View style={{height:size,width:size,borderRadius:12,backgroundColor:"#f5f8fc",
    borderWidth:1,borderColor:"#e0e7f0",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
    {source&&!failed?<Image source={source} resizeMode="contain"
      style={{width:size-8,height:size-8}} onError={()=>setFailed(true)}/>:
      <Package size={Math.floor(size*0.42)} color="#a5b2c5"/>}
  </View>;
}
