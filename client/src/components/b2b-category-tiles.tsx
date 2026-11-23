import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Boxes, ChevronLeft, ChevronRight, Package } from "lucide-react";
import {
  b2bCategoryHref, b2bCategoryImage, findB2BCategoryCard,
  type B2BHomepageCategories
} from "@/lib/b2b-categories";

export function B2BCategoryTiles({
  homepage, allHref, horizontal = false
}: {
  homepage: B2BHomepageCategories;
  /** A standalone directory links to the home catalog; the home section scrolls to its product list. */
  allHref?: string;
  /** Homepage categories stay in one horizontally scrollable row on every screen size. */
  horizontal?: boolean;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [railPosition, setRailPosition] = useState({left:false,right:false});

  const updateRailPosition = () => {
    const rail = railRef.current;
    if (!rail) return;
    setRailPosition({
      left: rail.scrollLeft > 2,
      right: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2,
    });
  };

  useEffect(() => {
    if (!horizontal) return;
    const rail = railRef.current;
    if (!rail) return;
    updateRailPosition();
    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(updateRailPosition) : null;
    observer?.observe(rail);
    window.addEventListener("resize", updateRailPosition);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateRailPosition);
    };
  }, [horizontal, homepage.categories.length]);

  const moveRail = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({left: direction * Math.max(185, rail.clientWidth * 0.75), behavior:"smooth"});
  };

  const imageClass = horizontal ? "h-[60px] sm:h-[72px]" : "aspect-[5/4]";
  const labelClass = horizontal ? "flex min-h-[34px] min-w-0 items-center justify-center px-1 py-1 text-center" : "flex min-h-[64px] min-w-0 items-center gap-2 p-3";
  const iconClass = horizontal ? "h-7 w-7 sm:h-8 sm:w-8" : "h-12 w-12";

  const allContent = <>
    <div className={`flex w-full items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 ${imageClass}`}>
      <Boxes className={`${iconClass} text-[#ffcd00]`} aria-hidden="true"/>
    </div>
    <div className={labelClass}>
      <span className={horizontal ? "text-[11px] font-extrabold leading-tight text-slate-950 sm:text-xs" : "text-base font-extrabold text-slate-950 sm:text-sm"}>Tüm Ürünler</span>
    </div>
  </>;

  const className = "group block shrink-0 snap-start overflow-hidden border border-slate-200 bg-white text-left shadow-sm transition-all hover:border-amber-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 " +
    (horizontal ? "w-[88px] rounded-xl sm:w-[112px]" : "w-[65vw] max-w-[240px] rounded-2xl sm:w-auto sm:max-w-none");

  const railClasses = "-mx-4 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-4 [-webkit-overflow-scrolling:touch] " +
    (horizontal
      ? "gap-2 pb-1 pt-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      : "gap-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5 xl:grid-cols-6");

  return <div className={horizontal ? "relative min-w-0" : undefined}>
    <div ref={railRef} className={railClasses}
      onScroll={horizontal ? updateRailPosition : undefined}
      aria-label="Kategoriler, sağa kaydırarak gezebilirsiniz">
      {allHref ? <Link href={allHref} className={className+" border-amber-400 ring-1 ring-amber-200"}>{allContent}</Link>
        : <button type="button" onClick={()=>document.getElementById("urunler")?.scrollIntoView({behavior:"smooth",block:"start"})}
            className={className+" border-amber-400 ring-1 ring-amber-200"}>{allContent}</button>}
      {homepage.categories.map(category=>{
        const card=findB2BCategoryCard(homepage,category);
        const imageUrl=b2bCategoryImage(card?.imageId);
        return <Link href={b2bCategoryHref(category)} key={category} className={className}>
          <div className={`flex w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 to-slate-200 ${imageClass}`}>
            {imageUrl ? <img src={imageUrl} alt="" loading="lazy"
              className={`h-full w-full object-contain transition-transform duration-300 group-hover:scale-105 ${horizontal ? "p-1.5" : "p-2 sm:p-3"}`}/>
              : <Package className={`${iconClass} text-slate-400`} aria-hidden="true"/>}
          </div>
          <div className={labelClass}>
            <span className={`min-w-0 break-words font-extrabold capitalize text-slate-900 ${horizontal ? "text-[11px] leading-tight sm:text-xs" : "text-sm"}`}>{card?.label||category}</span>
          </div>
        </Link>;
      })}
    </div>
    {horizontal && <>
      <button type="button" onClick={()=>moveRail(-1)} disabled={!railPosition.left}
        aria-label="Önceki kategorileri göster"
        className="absolute left-1 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 p-2 text-slate-700 shadow-lg hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 disabled:hidden sm:flex">
        <ChevronLeft size={20}/>
      </button>
      <button type="button" onClick={()=>moveRail(1)} disabled={!railPosition.right}
        aria-label="Sonraki kategorileri göster"
        className="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 p-2 text-slate-700 shadow-lg hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 disabled:hidden sm:flex">
        <ChevronRight size={20}/>
      </button>
    </>}
  </div>;
}
