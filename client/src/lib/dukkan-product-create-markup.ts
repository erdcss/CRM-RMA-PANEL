import {suggestedSaleFromMarkup} from "./dukkan-profit-price";

export type DukkanMarkupChoice = "10"|"20"|"30"|"custom"|null;

/** Pure helpers ensure the new-product form and existing product editor have
 * identical mark-up-on-cost calculations (not margin-on-revenue).
 */
export function applyDukkanNewProductMarkup(
  draft:Record<string,string>,choice:DukkanMarkupChoice,customRate:string,
):Record<string,string>{
  if(choice===null)return draft;
  const proposed=suggestedSaleFromMarkup(draft.purchasePrice||"",choice==="custom"?customRate:choice);
  return proposed===null?draft:{...draft,salePrice:proposed.toFixed(2)};
}
export function updateDukkanNewProductPrice(
  draft:Record<string,string>,field:string,value:string,
  choice:DukkanMarkupChoice,customRate:string,
):Record<string,string>{
  const next={...draft,[field]:value};
  return field==="purchasePrice"?applyDukkanNewProductMarkup(next,choice,customRate):next;
}
