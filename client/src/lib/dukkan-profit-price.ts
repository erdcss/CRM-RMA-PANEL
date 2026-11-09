/**
 * Product-editor markup calculator. The selected percentage is a mark-up on
 * purchase cost, NOT a net margin on the sale price.
 *
 * All results are displayed per unit and rounded to two decimal places.
 * VAT, fees, shipping and other overhead are not provided by the editor, so
 * the price difference MUST NOT be represented as an accounting net profit.
 */
export type ProfitPreview = {
  purchase: number;
  sale: number;
  profit: number;
  markupPercent: number;
  marginPercent: number;
};

export function parsePriceInput(value:string|number):number|null {
  const normalized=String(value).trim().replace(",",".");
  if(!normalized)return null;
  const parsed=Number(normalized);
  return Number.isFinite(parsed)&&parsed>=0&&parsed<=1_000_000_000?parsed:null;
}

export function parseMarkupPercent(value:string|number):number|null {
  const normalized=String(value).trim().replace(",",".");
  if(!normalized)return null;
  const amount=Number(normalized);
  return Number.isFinite(amount)&&amount>=0&&amount<=1000?amount:null;
}

export function suggestedSaleFromMarkup(purchaseValue:string|number,rateValue:string|number):number|null {
  const purchase=parsePriceInput(purchaseValue);
  const rate=parseMarkupPercent(rateValue);
  if(purchase===null||purchase<=0||rate===null)return null;
  const rounded=Math.round((purchase*(1+rate/100)+Number.EPSILON)*100)/100;
  return Number.isFinite(rounded)&&rounded<=1_000_000_000?rounded:null;
}

export function productProfitPreview(purchaseValue:string|number,saleValue:string|number):ProfitPreview|null {
  const purchase=parsePriceInput(purchaseValue);
  const sale=parsePriceInput(saleValue);
  if(purchase===null||purchase<=0||sale===null)return null;
  const profit=Math.round(((sale-purchase)+Number.EPSILON)*100)/100;
  return {
    purchase,sale,profit,
    markupPercent:(sale-purchase)/purchase*100,
    marginPercent:sale>0?(sale-purchase)/sale*100:0,
  };
}
