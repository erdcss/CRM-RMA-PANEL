/** Pure campaign product search and presentation rules, shared by the admin picker. */
export type CampaignProductOption={
  id:number|string;
  name:string;
  sku?:string|null;
  brand?:string|null;
  category?:string|null;
  collection_name?:string|null;
  price?:number|string|null;
  stock?:number|string|null;
  units_per_box?:number|string|null;
  image_data?:string|null;
  image_url?:string|null;
  images?:unknown;
  is_active?:boolean|null;
};

export function campaignProductImage(product:CampaignProductOption|undefined):string|null{
  if(!product)return null;
  const first=Array.isArray(product.images)?product.images.find(
    (item:unknown):item is string=>typeof item==="string"&&Boolean(item.trim())
  ):null;
  for(const candidate of [first,product.image_data,product.image_url]){
    if(typeof candidate!=="string")continue;
    const url=candidate.trim();
    // Images already supplied by the product catalog. Never accept script URLs.
    if(/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(url)||
       /^https?:\/\/[^\s]+$/i.test(url)||
       /^\/(?!\/)[^\s]*$/.test(url))return url;
  }
  return null;
}

export function campaignProductPrice(value:unknown):string {
  if(value===null||value===undefined||value==="")return "Fiyat belirtilmedi";
  const amount=Number(value);
  if(!Number.isFinite(amount)||amount<0)return "Fiyat belirtilmedi";
  return amount.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})+" ₺";
}

export function findCampaignProducts(products:CampaignProductOption[],query:string,assigned:number[],limit=18){
  const phrase=query.replace(/\s+/g," ").trim().toLocaleLowerCase("tr-TR");
  if(phrase.length<2)return [];
  const terms=phrase.split(" ").filter(Boolean);
  const selected=new Set(assigned);
  return products.filter(product=>{
    const id=Number(product.id);
    if(!Number.isSafeInteger(id)||id<=0||selected.has(id)||product.is_active===false)return false;
    const haystack=[product.name,product.sku,product.brand,product.category,product.collection_name]
      .map(v=>String(v||"")).join(" ").toLocaleLowerCase("tr-TR");
    return terms.every(term=>haystack.includes(term));
  }).slice(0,Math.min(60,Math.max(1,limit)));
}

export function appendCampaignProduct(assigned:number[],id:unknown,max=60):number[]{
  const candidate=Number(id);
  if(!Number.isSafeInteger(candidate)||candidate<=0||assigned.length>=max||assigned.includes(candidate)){
    return assigned;
  }
  return [...assigned,candidate];
}
