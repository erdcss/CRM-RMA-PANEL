import { Tag, X } from "lucide-react";

type Props = {
  salePrice: string;
  campaignPrice: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: (enabled: boolean) => void;
  onChange: (price: string) => void;
};

const formatPrice = (value: number) =>
  value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";

/** Campaigns preserve the base price; the reduced price is optional and never equal/higher. */
export function DukkanCampaignPriceControl({
  salePrice, campaignPrice, enabled, disabled = false, onToggle, onChange,
}: Props) {
  const base = Number(salePrice);
  const discount = Number(campaignPrice);
  const validBase = salePrice.trim() !== "" && Number.isFinite(base) && base > 0;
  const validCampaign = enabled && campaignPrice.trim() !== "" &&
    Number.isFinite(discount) && discount > 0 && discount < base &&
    Math.abs(discount * 100 - Math.round(discount * 100)) < 0.000001;

  return (
    <div className="mt-2 min-w-0">
      <button type="button" disabled={disabled} aria-expanded={enabled}
        onClick={() => {
          if (enabled) onChange("");
          onToggle(!enabled);
        }}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50">
        {enabled ? <X size={14} aria-hidden="true" /> : <Tag size={14} aria-hidden="true" />}
        {enabled ? "Kampanyalı Fiyatı Kaldır" : "Kampanyalı Fiyat Ekle"}
      </button>
      {enabled && (
        <div className="mt-2 rounded-xl border border-amber-200 bg-[#fffcf2] p-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Kampanyalı Satış Fiyatı (TL)</span>
            <input type="number" min="0.01" step="0.01" inputMode="decimal"
              required disabled={disabled} value={campaignPrice}
              onChange={event => onChange(event.target.value)}
              placeholder="Örn: 599,90"
              aria-invalid={campaignPrice.trim() !== "" && !validCampaign}
              className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
          </label>
          {!validBase && <p className="mt-1.5 text-xs text-amber-800">Önce normal satış fiyatını girin.</p>}
          {campaignPrice.trim() !== "" && !validCampaign && validBase &&
            <p role="alert" className="mt-1.5 text-xs font-semibold text-red-700">
              Kampanya fiyatı 0'dan büyük, normal satış fiyatından düşük ve en fazla iki ondalıklı olmalı.
            </p>}
          {validCampaign && (
            <div className="mt-3" aria-label="Kampanya fiyat önizlemesi">
              <span className="text-xs text-slate-400 line-through">{formatPrice(base)}</span>
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-xl font-black text-red-600">{formatPrice(discount)}</strong>
                <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
                  %{Math.round((1 - discount / base) * 100)} indirim
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
