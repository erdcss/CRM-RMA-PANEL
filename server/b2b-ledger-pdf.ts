import { inflateSync } from "node:zlib";

/** Restricted text-layer PDF reader with no external upload/storage service.
 * Covers conventional object streams, Flate compression, and embedded Unicode maps.
 * Image-only, encrypted, malformed and unsupported PDFs are rejected (never guessed).
 */
function hexUnicode(hex: string) {
  const bytes = Buffer.from(hex, "hex");
  let out = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) out += String.fromCharCode(bytes.readUInt16BE(i));
  return out;
}
export function extractTextLayerPdf(bytes: Buffer): string[] {
  if (bytes.length > 5_000_000 || bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new Error("En fazla 5 MB büyüklüğünde geçerli bir PDF seçin.");
  }
  const raw = bytes.toString("latin1");
  if (/\/Encrypt\b/.test(raw)) throw new Error("Şifreli PDF desteklenmiyor.");
  const objects = new Map<number, string>();
  for (const m of raw.matchAll(/(\d+)\s+\d+\s+obj\b([\s\S]*?)\bendobj\b/g)) objects.set(Number(m[1]), m[2]);
  if (!objects.size) throw new Error("PDF metin nesneleri bulunamadı.");

  function stream(id: number): string | null {
    const obj = objects.get(id) || "";
    const st = obj.indexOf("stream");
    if (st < 0) return null;
    let from = st + 6;
    if (obj[from] === "\r") from++;
    if (obj[from] === "\n") from++;
    const end = obj.indexOf("endstream", from);
    if (end < 0) return null;
    let body = obj.slice(from, end);
    if (body.endsWith("\r\n")) body = body.slice(0, -2);
    else if (body.endsWith("\n")) body = body.slice(0, -1);
    let buffer = Buffer.from(body, "latin1");
    if (/\/FlateDecode\b/.test(obj.slice(0, st))) buffer = inflateSync(buffer, { maxOutputLength: 12_000_000 });
    else if (/\/Filter\s*\/\w+/.test(obj.slice(0, st))) return null;
    return buffer.toString("latin1");
  }

  const maps = new Map<number, Map<string, string>>();
  for (const [id, obj] of objects) {
    if (!/\/Type\s*\/Font\b/.test(obj)) continue;
    const unicode = /\/ToUnicode\s+(\d+)\s+\d+\s+R/.exec(obj);
    if (!unicode) continue;
    const cmap = stream(Number(unicode[1]));
    if (!cmap) continue;
    const map = new Map<string, string>();
    for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
      for (const ch of block[1].matchAll(/<([a-fA-F0-9]+)>\s*<([a-fA-F0-9]+)>/g)) {
        map.set(ch[1].toUpperCase(), hexUnicode(ch[2]));
      }
    }
    for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
      for (const range of block[1].matchAll(/<([a-fA-F0-9]+)>\s*<([a-fA-F0-9]+)>\s*<([a-fA-F0-9]+)>/g)) {
        const start = parseInt(range[1], 16), end = parseInt(range[2], 16), base = parseInt(range[3], 16);
        if (end - start > 1000) continue;
        for (let i = start; i <= end; i++) {
          map.set(i.toString(16).toUpperCase().padStart(range[1].length, "0"), String.fromCodePoint(base + i - start));
        }
      }
    }
    maps.set(id, map);
  }
  const aliases = new Map<string, Map<string, string>>();
  for (const obj of objects.values()) {
    for (const font of obj.matchAll(/\/(F\d+)\s+(\d+)\s+\d+\s+R/g)) {
      const map = maps.get(Number(font[2]));
      if (map) aliases.set(font[1], map);
    }
  }

  const pages: number[][] = [];
  for (const obj of objects.values()) {
    if (!/\/Type\s*\/Page\b/.test(obj)) continue;
    const value = /\/Contents\s*(\[[^\]]+\]|\d+\s+\d+\s+R)/.exec(obj);
    if (value) pages.push([...value[1].matchAll(/(\d+)\s+\d+\s+R/g)].map(m => Number(m[1])));
  }
  if (!pages.length || pages.length > 20) throw new Error("Bu PDF biçimi desteklenmiyor veya 20 sayfa sınırını aşıyor.");
  function decodeHex(hex: string, cmap: Map<string, string> | undefined) {
    if (!cmap) return Buffer.from(hex, "hex").toString("utf8");
    const width = hex.length % 4 === 0 ? 4 : 2;
    return (hex.match(new RegExp(".{1," + width + "}", "g")) || []).map(code => cmap.get(code.toUpperCase()) || "").join("");
  }
  const lines: string[] = [];
  for (const ids of pages) for (const id of ids) {
    const contents = stream(id);
    if (!contents) continue;
    for (const block of contents.matchAll(/\bBT\b([\s\S]*?)\bET\b/g)) {
      const text = block[1];
      const font = /\/(F\d+)\s+[\d.]+\s+Tf/.exec(text)?.[1];
      const map = font ? aliases.get(font) : undefined;
      const parts: string[] = [];
      for (const item of text.matchAll(/<([0-9A-Fa-f]+)>\s*Tj|\(([^)]*)\)\s*Tj|\[([^\]]+)\]\s*TJ/g)) {
        if (item[1]) parts.push(decodeHex(item[1], map));
        else if (item[2]) parts.push(item[2]);
        else if (item[3]) {
          for (const member of item[3].matchAll(/<([0-9A-Fa-f]+)>|\(([^)]*)\)/g)) {
            parts.push(member[1] ? decodeHex(member[1], map) : member[2]);
          }
        }
      }
      const full = parts.join("").trim();
      if (full) lines.push(full);
    }
  }
  if (lines.length < 5) throw new Error("PDF metni okunamadı; taranmış PDF için OCR gerekli.");
  return lines;
}

export type ImportSection = "cash" | "bank" | "cari";
export type ExtractedBalance = { section: ImportSection; name: string; signedCents: string };
export type LedgerPdfResult = {
  rows: ExtractedBalance[];
  reportDate: string | null;
  totals: Record<ImportSection, { count: number; totalCents: string }>;
  verified: boolean;
  sourceLabel: string;
};
function cents(value: string): bigint | null {
  const raw = value.trim().replace(/\s*₺\s*|\s*TRY\s*/gi, "").replace(/\s/g, "");
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const neg = normalized.startsWith("-");
  const [units, fraction = ""] = normalized.replace(/^-/, "").split(".");
  const amount = BigInt(units) * 100n + BigInt(fraction.padEnd(2, "0") || "0");
  return neg ? -amount : amount;
}
function isAmount(line: string) { return /^-?[\d.,\s]+\s*₺\s*$/.test(line.trim()); }
const normalizedHeader = (line: string) => line.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").toUpperCase();

export function parseDefterBalancePdf(lines: string[]): LedgerPdfResult {
  const rows: ExtractedBalance[] = [];
  let section: ImportSection | null = null;
  let reachedSummary = false;
  for (let i = 0; i < lines.length - 1; i++) {
    const value = lines[i].trim(), normalized = normalizedHeader(value);
    if (normalized.includes("GENEL DURUM")) { reachedSummary = true; break; }
    if (/^NAKIT\s*\(KASA\)/.test(normalized)) { section = "cash"; continue; }
    if (normalized === "BANKA") { section = "bank"; continue; }
    if (/^CARI\s*\(BORC\s*\/\s*ALACAK\)/.test(normalized)) { section = "cari"; continue; }
    if (!section || !isAmount(lines[i + 1])) continue;
    const amount = cents(lines[i + 1]);
    if (amount === null || !value || value.length > 140 || rows.some(r => r.section === section && r.name.toLocaleLowerCase("tr-TR") === value.toLocaleLowerCase("tr-TR"))) {
      throw new Error("PDF'de okunamayan veya yinelenen hesap var: " + value);
    }
    if (amount > 999999999n || amount < -999999999n) throw new Error("Bir hesap bakiyesi izin verilen sınırı aşıyor: " + value);
    rows.push({ section, name: value, signedCents: amount.toString() });
    i++;
  }
  if (!reachedSummary) throw new Error("Bu PDF'de DEFTER genel durum başlığı bulunamadı. Bu sürümde yalnızca desteklenen dışa aktarım şablonları içe alınabilir.");
  if (!rows.length || rows.length > 250) throw new Error("PDF'de geçerli hesap bulunamadı veya 250 hesap sınırı aşıldı.");
  const totals = {
    cash: { count: 0, totalCents: "0" },
    bank: { count: 0, totalCents: "0" },
    cari: { count: 0, totalCents: "0" },
  };
  for (const kind of ["cash", "bank", "cari"] as const) {
    const group = rows.filter(r => r.section === kind);
    totals[kind] = { count: group.length, totalCents: group.reduce((a,r) => a + BigInt(r.signedCents), 0n).toString() };
  }
  const summaryIndex = lines.findIndex(x => normalizedHeader(x).includes("GENEL DURUM"));
  let verified = false;
  if (summaryIndex >= 0) {
    const tail = lines.slice(summaryIndex + 1);
    const summary: Record<string, { count: number; sum: bigint }> = {};
    for (let i = 0; i < tail.length; i++) {
      const name = normalizedHeader(tail[i]);
      const key = name.startsWith("NAKIT") ? "cash" : name === "BANKA" ? "bank" : name.startsWith("CARI") ? "cari" : name === "TOPLAM" ? "grand" : null;
      if (!key) continue;
      // Try the standard DEFTER report row: TRY, count, plus, minus, net.
      if (!/TRY|TL/.test(tail[i + 1] || "")) continue;
      const count = Number(tail[i + 2]);
      const total = cents(tail[i + 5] || "");
      if (Number.isInteger(count) && total !== null) summary[key] = { count, sum: total };
    }
    verified = ["cash", "bank", "cari", "grand"].every(key => Boolean(summary[key]));
    if (verified) {
      for (const key of ["cash", "bank", "cari"] as const) {
        if (summary[key].count !== totals[key].count || summary[key].sum.toString() !== totals[key].totalCents) {
          throw new Error("PDF genel durum toplamı ile hesap satırları uyuşmuyor: " + key);
        }
      }
      const grand = rows.reduce((a,r) => a + BigInt(r.signedCents), 0n);
      if (summary.grand.count !== rows.length || grand !== summary.grand.sum) {
        throw new Error("PDF genel toplamı hesap satırlarıyla uyuşmuyor.");
      }
    }
  }
  const text = lines.join(" ");
  const rawDate = /(\d{2})\/(\d{2})\/(\d{4})\s*\/\s*Web/i.exec(text);
  const reportDate = rawDate ? [rawDate[3],rawDate[2],rawDate[1]].join("-") : null;
  const label = lines.slice(0,2).join(" · ").slice(0,150);
  return { rows, totals, reportDate, verified, sourceLabel: label };
}
