import { B2BProductCard } from "@/components/b2b-product-card";
import type { UnifiedB2BProduct } from "@/lib/b2b-marketplace-products";

/**
 * Mobile: a single horizontal row of swipeable product cards.
 * Tablet/desktop: the original multi-column catalog grid.
 * The rail scrolls independently; the document never needs horizontal overflow.
 */
export function B2BProductRail({
  products, loggedIn, title
}: {
  products: UnifiedB2BProduct[];
  loggedIn: boolean;
  title?: string;
}) {
  return (
    <div
      role="region"
      aria-label={title || "Ürünleri sağa kaydırarak görüntüleyin"}
      className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-4 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4 xl:grid-cols-5"
    >
      {products.map(product=>(
        <div key={String(product.id)} className="w-[68vw] max-w-[260px] shrink-0 snap-start sm:w-auto sm:max-w-none">
          <B2BProductCard product={product} loggedIn={loggedIn}/>
        </div>
      ))}
    </div>
  );
}
