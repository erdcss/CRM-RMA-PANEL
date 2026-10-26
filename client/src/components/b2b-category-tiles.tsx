import { Link } from "wouter";
import { Boxes, Package } from "lucide-react";
import {
  b2bCategoryHref, b2bCategoryImage, findB2BCategoryCard,
  type B2BHomepageCategories
} from "@/lib/b2b-categories";

export function B2BCategoryTiles({
  homepage, allHref
}: {
  homepage: B2BHomepageCategories;
  /** A standalone directory links to the home catalog; the home section scrolls to its product list. */
  allHref?: string;
}) {
  const allContent = <>
    <div className="flex aspect-[5/4] w-full items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700">
      <Boxes className="h-12 w-12 text-[#ffcd00]" aria-hidden="true"/>
    </div>
    <div className="flex min-h-[64px] min-w-0 items-center gap-2 p-3">
      <span className="text-base font-extrabold text-slate-950 sm:text-sm">Tüm Ürünler</span>

    </div>
  </>;
  const className="group block w-[65vw] max-w-[240px] shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all hover:border-amber-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 sm:w-auto sm:max-w-none";

  return <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-3 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5 xl:grid-cols-6" aria-label="Kategoriler, sağa kaydırarak gezebilirsiniz">
    {allHref ? <Link href={allHref} className={className+" border-amber-400 ring-1 ring-amber-200"}>{allContent}</Link>
      : <button type="button" onClick={()=>document.getElementById("urunler")?.scrollIntoView({behavior:"smooth",block:"start"})}
          className={className+" border-amber-400 ring-1 ring-amber-200"}>{allContent}</button>}
    {homepage.categories.map(category=>{
      const card=findB2BCategoryCard(homepage,category);
      const imageUrl=b2bCategoryImage(card?.imageId);
      return <Link href={b2bCategoryHref(category)} key={category} className={className}>
        <div className="flex aspect-[5/4] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 to-slate-200">
          {imageUrl ? <img src={imageUrl} alt="" loading="lazy"
            className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105 sm:p-3"/>
            : <Package className="h-12 w-12 text-slate-400" aria-hidden="true"/>}
        </div>
        <div className="flex min-h-[64px] min-w-0 items-center gap-2 p-3">
          <span className="min-w-0 break-words text-sm font-extrabold capitalize text-slate-900">{card?.label||category}</span>
    
        </div>
      </Link>;
    })}
  </div>;
}
