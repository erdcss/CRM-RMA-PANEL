import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Boxes, Package, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { B2BHeader } from "@/components/b2b-header";
import { B2BFooter, B2BDesktopAppBanners } from "@/components/b2b-footer";
import { B2BProductRail } from "@/components/b2b-product-rail";
import { B2BCategoryTiles } from "@/components/b2b-category-tiles";
import { loadB2BHomepageCategories, b2bCategoryImage, b2bCategoryHref, b2bSubcategoryHref, findB2BCategoryCard, matchesB2BCategory, matchesB2BSubcategory } from "@/lib/b2b-categories";
import { loadApprovedSupplierProducts, type UnifiedB2BProduct } from "@/lib/b2b-marketplace-products";
import { trackSearch } from "@/lib/analytics";

type SessionUser={role?:string;isActive?:boolean};

function useB2BCategoryData(){
  const {data:homepage={categories:[]}}=useQuery({
    queryKey:["/api/public/homepage"],queryFn:loadB2BHomepageCategories,staleTime:15000
  });
  const {data:session}=useQuery<SessionUser|null>({
    queryKey:["/api/auth/me"],queryFn:async()=>{
      const response=await fetch("/api/auth/me",{credentials:"include"});
      return response.ok ? response.json() : null;
    },staleTime:15000,retry:false
  });
  const loggedIn=session?.role==="b2b_customer"&&session?.isActive===true;
  const {data:ownProducts=[],isLoading:ownLoading,isError:ownError}=useQuery<UnifiedB2BProduct[]>({
    queryKey:["/api/b2b/products",loggedIn?"member":"guest"],
    queryFn:async()=>{
      const response=await fetch("/api/b2b/products",{credentials:"include"});
      if(!response.ok)throw new Error("Ürün kataloğu alınamadı");
      const data=await response.json();
      return Array.isArray(data)?data:[];
    },staleTime:30000
  });
  const {data:supplierProducts=[],isLoading:supplierLoading,isError:supplierError}=useQuery<UnifiedB2BProduct[]>({
    queryKey:["/api/marketplace/products",loggedIn?"member":"guest"],
    queryFn:loadApprovedSupplierProducts,staleTime:30000
  });
  const products=useMemo(()=>[...supplierProducts,...ownProducts],[supplierProducts,ownProducts]);
  return {homepage,loggedIn,products,isLoading:ownLoading||supplierLoading,hasLoadError:ownError&&supplierError};
}

function useResetCategoryScroll(category:string){
  useEffect(()=>{
    const scrollContainer=document.querySelector<HTMLElement>(".b2b-site");
    if(scrollContainer)scrollContainer.scrollTop=0;
    else window.scrollTo(0,0);
  },[category]);
}

export function B2BCategoriesDirectory(){
  const {homepage}=useB2BCategoryData();
  useResetCategoryScroll("all-categories");
  return <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
    <B2BHeader/>
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4"/> Ana Sayfa
      </Link>
      <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Kategoriler</h1>
      <p className="mb-6 mt-2 text-sm text-slate-500">Ürün grubunu seçerek o kategoriye ait ürünleri görüntüleyin.</p>
      {homepage.categories.length ? <><p className="mb-2 text-xs font-semibold text-amber-800 sm:hidden">Kategorileri görmek için sağa kaydırın →</p><B2BCategoryTiles homepage={homepage} allHref="/#urunler"/></>
      : <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">Kategoriler hazırlanıyor veya henüz tanımlanmamış.</div>}
    </main>
    <B2BDesktopAppBanners/>
    <B2BFooter/>
  </div>;
}

export default function B2BCategoryPage({ category: rawCategory, subcategoryId }: { category: string; subcategoryId?: string }) {
  const category=useMemo(()=>{
    try{return decodeURIComponent(rawCategory).trim();}
    catch{return rawCategory.trim();}
  },[rawCategory]);
  const {homepage,loggedIn,products,isLoading,hasLoadError}=useB2BCategoryData();
  const [search,setSearch]=useState("");
  const card=useMemo(()=>findB2BCategoryCard(homepage,category),[homepage,category]);
  const subcategory=useMemo(()=>card?.subcategories?.find(item=>item.id===subcategoryId),[card,subcategoryId]);
  const isSubcategory=Boolean(subcategoryId);
  const picture=b2bCategoryImage(subcategory?.imageId || card?.imageId);
  const label=card?.label||category;
  const displayName=subcategory?.name||label;
  useResetCategoryScroll(category + (subcategoryId || ""));
  useEffect(()=>setSearch(""),[category,subcategoryId]);
  useEffect(()=>{
    const clean=search.trim();
    if(clean.length<2)return;
    const timer=window.setTimeout(()=>void trackSearch(clean),700);
    return()=>window.clearTimeout(timer);
  },[search]);
  const filtered=useMemo(()=>{
    const term=search.trim().toLocaleLowerCase("tr-TR");
    return products.filter(product=>{
      if(isSubcategory ? !subcategory || !matchesB2BSubcategory(product,subcategory) : !matchesB2BCategory(product,category,card))return false;
      return !term||[product.name,product.sku,product.category,product.collection_name,product.brand,product.seller_name]
        .filter(Boolean).some(value=>String(value).toLocaleLowerCase("tr-TR").includes(term));
    });
  },[products,category,card,subcategory,isSubcategory,search]);

  return <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
    <B2BHeader/>
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <nav aria-label="Gezinme yolu" className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/" className="text-slate-500 hover:text-slate-900">Ana Sayfa</Link>
        <span className="text-slate-400">/</span>
        <Link href="/kategoriler" className="text-slate-500 hover:text-slate-900">Kategoriler</Link>
        <span className="text-slate-400">/</span>
        {isSubcategory ? <>
          <Link href={b2bCategoryHref(category)} className="text-slate-500 hover:text-slate-900">{label}</Link>
          <span className="text-slate-400">/</span>
        </> : null}
        <span className="font-bold text-slate-900">{displayName}</span>
      </nav>
      <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="category-title">
        <div className="flex items-center gap-4 p-4 sm:gap-6 sm:p-6">
          <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 sm:h-36 sm:w-36">
            {picture?<img src={picture} alt="" className="h-full w-full object-contain p-2"/>
            :<Boxes className="h-12 w-12 text-slate-300" aria-hidden="true"/>}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Çalışkan B2B · {isSubcategory ? "Alt Kategori" : "Kategori"}</span>
            <h1 id="category-title" className="mt-1 break-words text-2xl font-black capitalize leading-tight sm:text-3xl">{displayName}</h1>
            <p className="mt-2 text-sm text-slate-500">{isLoading?"Ürünler yükleniyor…":filtered.length+" ürün"}</p>
          </div>
        </div>
      </section>
      <label className="relative mb-5 block" aria-label="Bu kategoride ürün ara">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"/>
        <Input value={search} onChange={event=>setSearch(event.target.value)}
          className="h-12 rounded-xl bg-white pl-12" placeholder={displayName+" kategorisinde ürün ara"}/>
      </label>
      {!isSubcategory && Boolean(card?.subcategories?.length) && <section className="mb-7" aria-labelledby="subcategory-heading">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="subcategory-heading" className="text-xl font-black">Alt Kategoriler</h2>
          <span className="text-sm text-slate-500">{card?.subcategories?.length} alt kategori</span>
        </div>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-5">
          {(card?.subcategories || []).map(item => {
            const image=b2bCategoryImage(item.imageId);
            const count=products.filter(product => matchesB2BSubcategory(product,item)).length;
            return <Link key={item.id} href={b2bSubcategoryHref(category,item.id)}
              className="group w-[42vw] min-w-[145px] max-w-[205px] shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-amber-300 hover:shadow-md sm:w-auto sm:max-w-none">
              <div className="flex aspect-[5/4] items-center justify-center overflow-hidden bg-slate-50">
                {image ? <img src={image} alt="" loading="lazy" className="h-full w-full object-contain p-3 transition-transform group-hover:scale-105"/>
                  : <Boxes className="h-12 w-12 text-slate-300" aria-hidden="true"/>}
              </div>
              <div className="p-3">
                <h3 className="line-clamp-2 text-sm font-bold text-slate-900">{item.name}</h3>
                <p className="mt-1 text-xs text-slate-500">{isLoading ? "Yükleniyor…" : count + " ürün"}</p>
              </div>
            </Link>;
          })}
        </div>
      </section>}
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="text-xl font-black">{isSubcategory ? "Alt Kategori Ürünleri" : "Kategori Ürünleri"}</h2>
        {!isLoading?<span className="text-sm text-slate-500">{filtered.length} ürün</span>:null}
      </div>
      {isLoading?<div className="rounded-2xl border bg-white p-10 text-center text-slate-500">Ürünler yükleniyor…</div>
      :hasLoadError?<div role="alert" className="rounded-2xl border bg-white p-10 text-center text-slate-600">Ürünler şu anda alınamıyor. Sayfayı yenileyerek tekrar deneyin.</div>
      :filtered.length===0?<div className="rounded-2xl border bg-white p-10 text-center">
        <Package className="mx-auto h-12 w-12 text-slate-300"/>
        <h3 className="mt-3 font-bold">{isSubcategory && !subcategory ? "Alt kategori bulunamadı" : "Bu kategoride ürün bulunamadı"}</h3>
        <p className="mt-1 text-sm text-slate-500">Başka bir kategori seçebilir veya aramayı temizleyebilirsiniz.</p>
        <Link href="/kategoriler" className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">Diğer Kategoriler</Link>
      </div>
      :<div>
        <p className="mb-2 text-xs font-semibold text-amber-800 sm:hidden">Ürünleri görmek için sağa kaydırın →</p>
        <B2BProductRail products={filtered} loggedIn={loggedIn} title={displayName+" kategorisindeki ürünler"}/>
      </div>}
      <Link href={isSubcategory ? b2bCategoryHref(category) : "/kategoriler"} className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-amber-900 hover:underline">
        <ArrowLeft className="h-4 w-4"/> {isSubcategory ? label + " kategorisine dön" : "Tüm kategorilere dön"}
      </Link>
    </main>
    <B2BDesktopAppBanners/>
    <B2BFooter/>
  </div>;
}
