import JsBarcode from "jsbarcode";
import {
  resolveBarcodeHeightMm,
  resolveNumberFontSizePt,
  sanitizeBarcodeNumber,
  type BarcodeLabelSettings,
} from "@shared/barcode-label";

const MM_TO_PX = 96 / 25.4;

export function mmToPx(mm: number) {
  return mm * MM_TO_PX;
}

export type BarcodeRenderResult = {
  svgMarkup: string;
  barWidth: number;
  fits: boolean;
};

export function renderCode128Svg(
  value: string,
  settings: BarcodeLabelSettings,
): BarcodeRenderResult {
  const cleaned = sanitizeBarcodeNumber(value);
  const contentWidthMm =
    settings.labelWidthMm - settings.marginLeftMm - settings.marginRightMm;
  const barcodeHeightMm = resolveBarcodeHeightMm(settings);
  const targetWidthPx = mmToPx(contentWidthMm);
  const heightPx = mmToPx(barcodeHeightMm);
  const quietZonePx = Math.max(4, Math.round(mmToPx(Math.min(settings.marginLeftMm, settings.marginRightMm, 1.5))));

  let bestMarkup = "";
  let bestBarWidth = 1;
  let bestWidth = Infinity;

  for (let barWidth = 2.4; barWidth >= 0.6; barWidth -= 0.05) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    try {
      JsBarcode(svg, cleaned, {
        format: "CODE128",
        displayValue: false,
        margin: quietZonePx,
        height: heightPx,
        width: barWidth,
        lineColor: "#000000",
        background: "#ffffff",
        flat: true,
      });
    } catch {
      continue;
    }

    const widthAttr = Number(svg.getAttribute("width") ?? 0);
    const markup = new XMLSerializer().serializeToString(svg);
    if (widthAttr <= targetWidthPx && widthAttr < bestWidth) {
      bestWidth = widthAttr;
      bestMarkup = markup;
      bestBarWidth = barWidth;
    }
    if (widthAttr <= targetWidthPx) break;
  }

  if (!bestMarkup) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, cleaned, {
      format: "CODE128",
      displayValue: false,
      margin: quietZonePx,
      height: heightPx,
      width: 0.6,
      lineColor: "#000000",
      background: "#ffffff",
      flat: true,
    });
    bestMarkup = new XMLSerializer().serializeToString(svg);
    bestBarWidth = 0.6;
    bestWidth = Number(svg.getAttribute("width") ?? 0);
  }

  return {
    svgMarkup: bestMarkup,
    barWidth: bestBarWidth,
    fits: bestWidth <= targetWidthPx,
  };
}

export function buildLabelStyleVars(settings: BarcodeLabelSettings, digitCount: number) {
  const fontPt = resolveNumberFontSizePt(settings, digitCount);
  return {
    widthMm: settings.labelWidthMm,
    heightMm: settings.labelHeightMm,
    paddingTopMm: settings.marginTopMm,
    paddingRightMm: settings.marginRightMm,
    paddingBottomMm: settings.marginBottomMm,
    paddingLeftMm: settings.marginLeftMm,
    barcodeHeightMm: resolveBarcodeHeightMm(settings),
    gapMm: settings.barcodeNumberGapMm,
    fontPt,
    offsetXmm: settings.offsetXmm,
    offsetYmm: settings.offsetYmm,
  } as const;
}

export function buildPrintPageHtml(
  value: string,
  settings: BarcodeLabelSettings,
  render: BarcodeRenderResult,
  isLast = false,
): string {
  const cleaned = sanitizeBarcodeNumber(value);
  const vars = buildLabelStyleVars(settings, cleaned.length);
  const numberBlock = settings.showHumanReadable
    ? `<div class="barcode-label-number" style="font-size:${vars.fontPt}pt;line-height:1;font-family:Arial,Helvetica,sans-serif;font-weight:600;color:#000;text-align:center;white-space:nowrap;flex-shrink:0">${cleaned}</div>`
    : "";

  const pageBreak = isLast ? "" : "page-break-after:always;break-after:page;";

  return `<div class="barcode-print-page" style="
    width:${vars.widthMm}mm;
    height:${vars.heightMm}mm;
    box-sizing:border-box;
    overflow:hidden;
    ${pageBreak}
    background:#fff;
  ">
    <div class="barcode-label-inner" style="
      width:100%;
      height:100%;
      box-sizing:border-box;
      padding:${vars.paddingTopMm}mm ${vars.paddingRightMm}mm ${vars.paddingBottomMm}mm ${vars.paddingLeftMm}mm;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:flex-start;
      transform:translate(${vars.offsetXmm}mm, ${vars.offsetYmm}mm);
      background:#fff;
    ">
      <div class="barcode-label-bars" style="
        width:100%;
        height:${vars.barcodeHeightMm}mm;
        display:flex;
        align-items:center;
        justify-content:center;
        flex-shrink:0;
        overflow:visible;
      ">${render.svgMarkup.replace(
        "<svg",
        '<svg style="max-width:100%;height:100%;display:block" preserveAspectRatio="xMidYMid meet"',
      )}</div>
      ${numberBlock ? `<div style="height:${vars.gapMm}mm;flex-shrink:0"></div>${numberBlock}` : ""}
    </div>
  </div>`;
}

export function buildPrintDocumentHtml(
  value: string,
  settings: BarcodeLabelSettings,
  render: BarcodeRenderResult,
): string {
  const pages = Array.from({ length: settings.quantity }, (_, index) =>
    buildPrintPageHtml(value, settings, render, index === settings.quantity - 1),
  ).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Barkod Etiket</title>
<style>
  @page { size: ${settings.labelWidthMm}mm ${settings.labelHeightMm}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .barcode-print-root { margin: 0; padding: 0; }
  .barcode-print-page:last-child { page-break-after: auto !important; break-after: auto !important; }
  svg rect[fill="#ffffff"], svg rect[fill="#FFFFFF"], svg rect[fill="white"] { fill: #fff !important; }
  svg rect[fill="#000000"], svg rect[fill="#000"], svg rect[fill="black"] { fill: #000 !important; }
</style>
</head>
<body>
<div class="barcode-print-root">${pages}</div>
</body>
</html>`;
}

export function openBarcodePrintWindow(
  value: string,
  settings: BarcodeLabelSettings,
  render: BarcodeRenderResult,
) {
  const html = buildPrintDocumentHtml(value, settings, render);
  const win = window.open("", "_blank", "width=480,height=320");
  if (!win) {
    throw new Error("Yazdırma penceresi açılamadı. Pop-up engelleyiciyi kontrol edin.");
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  const trigger = () => {
    win.print();
    win.close();
  };
  if (win.document.readyState === "complete") {
    setTimeout(trigger, 250);
  } else {
    win.onload = () => setTimeout(trigger, 250);
  }
}
