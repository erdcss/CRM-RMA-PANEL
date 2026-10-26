import { Link } from "wouter";
import { Boxes, ChevronRight, Package } from "lucide-react";
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
    <div className="flex h-32 w-32 shrink-0 items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 sm:aspect-[5/4] sm:h-auto sm:w-full">
      <Boxes className="h-12 w-12 text-[#ffcd00]" aria-hidden="true"/>
    </div>
    <div className="flex min-h-28 min-w-0 flex-1 items-center justify-between gap-2 p-4 sm:min-h-14 sm:p-3">
      <span className="text-base font-extrabold text-slate-950 sm:text-sm">Tüm Ürünler</span>
      <ChevronRight className="h-5 w-5 shrink-0 text-amber-500 sm:hidden" aria-hidden="true"/>
    </div>
  </>;
  const className="group flex min-w-0 items-stretch overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 sm:block";

  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6" aria-label="Görselli ürün kategorileri">
    {allHref ? <Link href={allHref} className={className+" border-amber-400 ring-1 ring-amber-200"}>{allContent}</Link>
      : <button type="button" onClick={()=>document.getElementById("urunler")?.scrollIntoView({behavior:"smooth",block:"start"})}
          className={className+" border-amber-400 ring-1 ring-amber-200"}>{allContent}</button>}
    {homepage.categories.map(category=>{
      const card=findB2BCategoryCard(homepage,category);
      const imageUrl=b2bCategoryImage(card?.imageId);
      return <Link href={b2bCategoryHref(category)} key={category} className={className}>
        <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 to-slate-200 sm:aspect-[5/4] sm:h-auto sm:w-full">
          {imageUrl ? <img src={imageUrl} alt="" loading="lazy"
            className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105 sm:p-3"/>
            : <Package className="h-12 w-12 text-slate-400" aria-hidden="true"/>}
        </div>
        <div className="flex min-h-28 min-w-0 flex-1 items-center justify-between gap-2 p-4 sm:min-h-14 sm:p-3">
          <span className="min-w-0 break-words text-base font-extrabold capitalize text-slate-900 sm:text-sm">{card?.label||category}</span>
          <ChevronRight className="h-5 w-5 shrink-0 text-amber-500 sm:hidden" aria-hidden="true"/>
        </div>
      </Link>;
    })}
  </div>;
}
