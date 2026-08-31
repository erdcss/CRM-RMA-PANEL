import { useEffect, useMemo, useState } from "react";
import {
  estimateBarcodeFit,
  sanitizeBarcodeNumber,
  validateBarcodeNumber,
  type BarcodeLabelSettings,
} from "@shared/barcode-label";
import { buildLabelStyleVars, renderCode128Svg } from "@/lib/barcodeLabelRenderer";
import "@/styles/barcode-label.css";

export type BarcodeLabelProps = {
  value: string;
  settings: BarcodeLabelSettings;
  /** Ekran önizlemesi için ölçek (mm → px). Yazdırma modunda 1 kullanılır. */
  previewScale?: number;
  mode?: "preview" | "print";
  className?: string;
};

export function BarcodeLabel({
  value,
  settings,
  previewScale = 8,
  mode = "preview",
  className,
}: BarcodeLabelProps) {
  const cleaned = sanitizeBarcodeNumber(value);
  const validation = validateBarcodeNumber(cleaned);
  const [render, setRender] = useState<{ svgMarkup: string; fits: boolean } | null>(null);

  useEffect(() => {
    if (!validation.valid || typeof document === "undefined") {
      setRender(null);
      return;
    }
    try {
      const result = renderCode128Svg(cleaned, settings);
      setRender({ svgMarkup: result.svgMarkup, fits: result.fits });
    } catch {
      setRender(null);
    }
  }, [cleaned, settings, validation.valid]);

  const fit = useMemo(
    () => estimateBarcodeFit(cleaned, settings.labelWidthMm, settings.marginLeftMm, settings.marginRightMm),
    [cleaned, settings.labelWidthMm, settings.marginLeftMm, settings.marginRightMm],
  );

  const vars = buildLabelStyleVars(settings, cleaned.length);
  const isPreview = mode === "preview";
  const widthPx = settings.labelWidthMm * previewScale;
  const heightPx = settings.labelHeightMm * previewScale;

  if (!validation.valid) {
    return (
      <div className={`barcode-label-invalid ${className ?? ""}`}>
        {validation.error}
      </div>
    );
  }

  return (
    <div className={`barcode-label-wrap ${className ?? ""}`}>
      <div
        className={`barcode-label ${isPreview ? "barcode-label--preview" : "barcode-label--print"}`}
        style={
          isPreview
            ? { width: widthPx, height: heightPx }
            : { width: `${settings.labelWidthMm}mm`, height: `${settings.labelHeightMm}mm` }
        }
        aria-label={`Barkod etiketi ${cleaned}`}
      >
        <div
          className="barcode-label-inner"
          style={{
            padding: isPreview
              ? `${vars.paddingTopMm * previewScale}px ${vars.paddingRightMm * previewScale}px ${vars.paddingBottomMm * previewScale}px ${vars.paddingLeftMm * previewScale}px`
              : `${vars.paddingTopMm}mm ${vars.paddingRightMm}mm ${vars.paddingBottomMm}mm ${vars.paddingLeftMm}mm`,
            transform: isPreview
              ? `translate(${vars.offsetXmm * previewScale}px, ${vars.offsetYmm * previewScale}px)`
              : `translate(${vars.offsetXmm}mm, ${vars.offsetYmm}mm)`,
          }}
        >
          <div
            className="barcode-label-bars"
            style={{ height: isPreview ? vars.barcodeHeightMm * previewScale : `${vars.barcodeHeightMm}mm` }}
            dangerouslySetInnerHTML={
              render
                ? {
                    __html: render.svgMarkup.replace(
                      "<svg",
                      '<svg style="max-width:100%;height:100%;display:block" preserveAspectRatio="xMidYMid meet"',
                    ),
                  }
                : undefined
            }
          />
          {settings.showHumanReadable ? (
            <>
              <div style={{ height: isPreview ? vars.gapMm * previewScale : `${vars.gapMm}mm` }} />
              <div
                className="barcode-label-number"
                style={{ fontSize: isPreview ? vars.fontPt * (previewScale / 3.78) : `${vars.fontPt}pt` }}
              >
                {cleaned}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {isPreview && (!fit.fits || render?.fits === false) && fit.warning ? (
        <p className="text-xs text-amber-600 mt-2">{fit.warning}</p>
      ) : null}
    </div>
  );
}

export { openBarcodePrintWindow, renderCode128Svg } from "@/lib/barcodeLabelRenderer";
