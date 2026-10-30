import { B2BProductCard } from "@/components/b2b-product-card";
import type { UnifiedB2BProduct } from "@/lib/b2b-marketplace-products";

/**
 * Responsive catalog: two compact, fully visible columns on phones;
 * three or more on larger screens. No horizontal product-card overflow.
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
      className="grid w-full min-w-0 grid-cols-2 gap-2 pb-4 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      {products.map(product=>(
        <div key={String(product.id)} className="min-w-0 w-full">
          <B2BProductCard product={product} loggedIn={loggedIn}/>
        </div>
      ))}
    </div>
  );
}
