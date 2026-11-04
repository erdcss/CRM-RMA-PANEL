import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowDownCircle, ArrowUpCircle, CalendarDays, ChevronLeft, ChevronRight,
  ClipboardList, History, Package, Plus, RefreshCw, Search, ShoppingBag,
  SlidersHorizontal, Truck, Wallet, Pencil, Trash2, ShieldCheck, AlertTriangle, X, Check, FileClock,
} from "lucide-react";
import { normalizeProductSearch } from "@/lib/dukkan-product-toolbar";

export type StockProduct = {
  id: string | number;
  sku?: string | null;
  barcode?: string | null;
  name?: string | null;
  brand?: string | null;
  stock?: string | number | null;
  image_url?: string | null;
  unit?: string | null;
  sale_price?: number | string | null;
};

type HistoryEntry = {
  id: number | string;
  created_at: string;
  delta: string | number;
  reason: string;
  note?: string | null;
  invoice_no?: string | null;
  issued_at?: string | null;
  party_name?: string | null;
  quantity?: string | number | null;
  unit_price?: string | number | null;
  line_total?: string | number | null;
  tax_rate?: string | number | null;
  voided_at?: string | null;
  edited_at?: string | null;
};
type AuditRow = {
  id:number|string;action:"edit"|"delete";previous_delta:string|number;new_delta:string|number;
  previous_note:string|null;new_note:string|null;stock_before:string|number;stock_after:string|number;
  changed_at:string;actor:string|null;
};

type Ledger = {
  product: StockProduct & { purchase_price?: string | number | null };
  entries: HistoryEntry[];
  stats: {
    total: number;
    purchased: string | number;
    sold: string | number;
    manual_in: string | number;
    manual_out: string | number;
    sale_returned: string | number;
    purchase_returned: string | number;
    unrecorded_balance: string | number;
  };
  page: number;
  totalPages: number;
  historyTotal: number;
};

type Props = {
  storeId: string;
  base: string;
  products: StockProduct[];
  canManage: boolean;
  onChanged: () => void;
  onError?: (error: string) => void;
};

const qty = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString("tr-TR", { maximumFractionDigits: 3 })
    : "—";
};
const money = (value: unknown) =>
  Number(value).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
const dateTime = (value?: string | null) =>
  value && !Number.isNaN(Date.parse(value))
    ? new Date(value).toLocaleString("tr-TR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";

const movementNames: Record<string, string> = {
  purchase: "Satın Alındı",
  sale: "Satıldı",
  sale_return: "Satış İadesi",
  purchase_return: "Alış İadesi",
  adjustment: "Manuel Stok İşlemi",
};

const cardStyle = "rounded-2xl border border-[#dce7f4] bg-white shadow-sm";
const fieldStyle = "h-11 w-full rounded-xl border border-[#d9e4f0] bg-white px-3.5 text-sm text-[#183355] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

async function stockRequest(url: string, options?: RequestInit, signal?: AbortSignal) {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    ...options,
    signal,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error ||
    (response.status===502||response.status===503||response.status===504
      ?"Sunucu geçici olarak erişilemedi. Aynı işlem kimliğiyle güvenle tekrar deneyebilirsiniz."
      :"Stok işlemi tamamlanamadı"));

  return json;
}

export function DukkanStockWorkspace({ storeId, base, products, canManage, onChanged, onError }: Props) {
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(40);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const requestKeyRef = useRef<string | null>(null);
  const [editing, setEditing] = useState<{id:string;direction:"in"|"out";amount:string;note:string}|null>(null);
  const [editingBusy,setEditingBusy]=useState(false);
  const [auditMovementId,setAuditMovementId]=useState<string|null>(null);
  const [auditRows,setAuditRows]=useState<AuditRow[]>([]);
  const [auditBusy,setAuditBusy]=useState(false);

  const matches = useMemo(() => {
    const words = normalizeProductSearch(search).split(" ").filter(Boolean);
    return products.filter(item => {
      if (!words.length) return true;
      const text = [item.name, item.sku, item.barcode, item.brand].map(normalizeProductSearch);
      return words.every(word => text.some(field => field.includes(word)));
    }).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "tr-TR", { numeric: true }));
  }, [products, search]);

  const selected = useMemo(
    () => products.find(item => String(item.id) === selectedId),
    [products, selectedId],
  );

  useEffect(() => {
    setSearch("");
    setSelectedId(null);
    setLedger(null);
    setPage(1);
    setLimit(40);
    setError("");
    setEditing(null);
    setAuditMovementId(null);
    requestKeyRef.current=null;
  }, [storeId]);

  const reload = useCallback(() => setRefresh(value => value + 1), []);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void stockRequest(
      base + "/stock-products/" + encodeURIComponent(selectedId) + "/history?page=" + page + "&pageSize=50",
      undefined,
      controller.signal,
    ).then((data: Ledger) => {
      if (!controller.signal.aborted) setLedger(data);
    }).catch((e: Error) => {
      if (!controller.signal.aborted) setError(e.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [base, selectedId, page, refresh]);

  // Revalidate the visible ledger while keeping its last successful rows mounted.
  useEffect(() => {
    if (!selectedId) return;
    const interval = window.setInterval(reload, 30000);
    return () => window.clearInterval(interval);
  }, [selectedId, reload]);

  const chooseProduct = (id: string | number) => {
    const next = String(id);
    if (selectedId !== next) {
      setLedger(null);
      setPage(1);
      setError("");
      setNotice("");
      setSelectedId(next);
      setEditing(null);
      setAuditMovementId(null);
      requestKeyRef.current=null;
    }
  };

  const adjust = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManage || !selectedId || busy) return;
    const count = Number(amount);
    if (!Number.isFinite(count) || count <= 0 || count > 999999999 ||
        Math.abs(count * 1000 - Math.round(count * 1000)) > 0.00001) {
      setError("Miktar pozitif olmalı ve en fazla 3 ondalık basamak içermelidir.");
      return;
    }
    if (note.trim().length < 3 || note.trim().length > 500) {
      setError("Stok işlemi için 3–500 karakter arasında açıklama girin.");
      return;
    }
    if (mode === "out" && count > Number(ledger?.product.stock ?? selected?.stock ?? 0)) {
      setError("Çıkarmak istediğiniz miktar mevcut stoktan fazla olamaz.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if(!requestKeyRef.current)requestKeyRef.current=crypto.randomUUID();
      await stockRequest(base + "/stock-movements", {
        method: "POST",
        body: JSON.stringify({
          productId: Number(selectedId),
          delta: mode === "in" ? count : -count,
          note: note.trim(),
          requestKey:requestKeyRef.current,
        }),
      });
      setAmount("");
      setNote("");
      requestKeyRef.current=null;
      setPage(1);
      reload();
      onChanged();
      setNotice(mode === "in" ? "Stok başarıyla eklendi." : "Stok başarıyla çıkarıldı.");
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  };


  const changeAdjustment=(field:"amount"|"note"|"mode",value:string)=>{
    requestKeyRef.current=null;
    if(field==="amount")setAmount(value);
    else if(field==="note")setNote(value);
    else setMode(value as "in"|"out");
  };

  const startEditing=(item:HistoryEntry)=>{
    if(!canManage||item.reason!=="adjustment"||item.voided_at)return;
    setEditing({
      id:String(item.id),
      direction:Number(item.delta)<0?"out":"in",
      amount:String(Math.abs(Number(item.delta))),
      note:item.note||"",
    });
    setNotice("");setError("");
  };

  const saveEditedMovement=async(event:FormEvent)=>{
    event.preventDefault();
    if(!editing||editingBusy)return;
    const count=Number(editing.amount);
    if(!Number.isFinite(count)||count<=0||count>999999999||
       Math.abs(count*1000-Math.round(count*1000))>0.00001){
      setError("Düzenleme miktarı en fazla üç ondalık basamak içermelidir.");return;
    }
    if(editing.note.trim().length<3){setError("Açıklama en az 3 karakter olmalıdır.");return;}
    setEditingBusy(true);setError("");setNotice("");
    try{
      await stockRequest(base+"/stock-movements/"+encodeURIComponent(editing.id),{
        method:"PATCH",
        body:JSON.stringify({
          delta:editing.direction==="in"?count:-count,
          note:editing.note.trim(),
        }),
      });
      setEditing(null);setPage(1);reload();onChanged();
      setNotice("Stok hareketi düzenlendi, fark stok miktarına yansıtıldı.");
    }catch(e){setError((e as Error).message);}
    finally{setEditingBusy(false);}
  };

  const removeMovement=async(item:HistoryEntry)=>{
    if(!canManage||busy||editingBusy||item.reason!=="adjustment"||item.voided_at)return;
    if(!window.confirm("Bu manuel stok hareketini silmek istediğinize emin misiniz? "+
      "Stok miktarı işlem öncesine göre düzeltilecek; denetim geçmişi korunacaktır."))return;
    setEditingBusy(true);setError("");setNotice("");
    try{
      await stockRequest(base+"/stock-movements/"+encodeURIComponent(String(item.id)),{
        method:"DELETE",
      });
      setEditing(null);setPage(1);reload();onChanged();
      setNotice("Manuel hareket silindi ve stok etkisi tersine çevrildi. Denetim kaydı korundu.");
    }catch(e){setError((e as Error).message);}
    finally{setEditingBusy(false);}
  };

  const viewAudit=async(item:HistoryEntry)=>{
    if(!canManage)return;
    const id=String(item.id);
    if(auditMovementId===id){setAuditMovementId(null);return;}
    setAuditMovementId(id);setAuditRows([]);setAuditBusy(true);setError("");
    try{
      const rows=await stockRequest(base+"/stock-movements/"+encodeURIComponent(id)+"/audit") as AuditRow[];
      setAuditRows(Array.isArray(rows)?rows:[]);
    }catch(e){setError((e as Error).message);}
    finally{setAuditBusy(false);}
  };

  return (
    <div className="space-y-4">
      <div className={cardStyle + " p-4 sm:p-5"}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-black text-[#123458]">
              <Search size={18} className="text-[#1971ad]"/> Ürün Stok Takibi
            </h3>
            <p className="mt-1 text-xs text-slate-500">Ürüne tıklayarak tüm kayıtlı giriş, çıkış, alış ve satış hareketlerini inceleyin.</p>
          </div>
          <span className="rounded-xl bg-[#eef6ff] px-3 py-2 text-xs font-bold text-[#215a8a]">
            {matches.length.toLocaleString("tr-TR")} ürün / {products.length.toLocaleString("tr-TR")} toplam
          </span>
        </div>
        <label className="relative mt-4 block">
          <span className="sr-only">Stok ürünü ara</span>
          <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input type="search" value={search} onChange={event => { setSearch(event.target.value); setLimit(40); }}
            placeholder="Ürün adı, stok kodu veya barkod ile ara..."
            className={fieldStyle + " pl-11"} autoComplete="off" aria-label="Stok ürünü ara"/>
        </label>
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(270px,340px)_minmax(0,1fr)]">
        <section aria-label="Ürün kartları" className={cardStyle + " min-w-0 overflow-hidden"}>
          <div className="flex items-center justify-between border-b border-[#edf1f7] px-4 py-3">
            <h4 className="text-sm font-extrabold text-[#16385e]">Ürünler</h4>
            <span className="text-xs text-slate-400">{Math.min(limit, matches.length)} gösteriliyor</span>
          </div>
          <div className="max-h-[760px] space-y-1.5 overflow-y-auto p-2.5">
            {matches.slice(0, limit).map(item => {
              const selectedCard = String(item.id) === selectedId;
              return (
                <button key={String(item.id)} type="button" onClick={() => chooseProduct(item.id)}
                  aria-pressed={selectedCard}
                  className={"flex min-h-[77px] w-full items-center gap-3 rounded-xl border px-2.5 py-2.5 text-left transition "+
                    (selectedCard
                      ? "border-sky-300 bg-[#ebf5ff] shadow-sm"
                      : "border-transparent bg-white hover:border-[#d7e5f6] hover:bg-[#f8fbff]")}>
                  <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#f0f4fa] text-[#8da2bc]">
                    {item.image_url ? <img src={item.image_url} alt="" loading="lazy" className="h-full w-full object-contain"/>
                      : <Package size={20}/>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-[#142d50]">{item.name || "İsimsiz ürün"}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-[#7a90a9]">
                      {item.sku || "Stok kodu yok"}{item.barcode ? " · " + item.barcode : ""}
                    </span>
                    <span className="mt-1 block text-[11px] font-semibold text-[#426080]">
                      Stok: {qty(item.stock)} {item.unit || "adet"}
                    </span>
                  </div>
                  <ChevronRightIcon active={selectedCard}/>
                </button>
              );
            })}
            {!matches.length && <div className="px-4 py-10 text-center text-sm text-slate-500">
              Aramaya uygun ürün bulunamadı.
            </div>}
            {limit < matches.length && (
              <button type="button" onClick={() => setLimit(value => value + 40)}
                className="w-full rounded-xl border border-sky-100 bg-sky-50 px-3 py-3 text-xs font-bold text-[#226395] hover:bg-sky-100">
                Daha fazla ürün göster ({(matches.length - limit).toLocaleString("tr-TR")} kaldı)
              </button>
            )}
          </div>
        </section>

        <section aria-label="Seçilen ürünün stok hareketleri" className="min-w-0 space-y-4">
          {!selectedId ? (
            <div className={cardStyle + " flex min-h-[330px] flex-col items-center justify-center p-8 text-center"}>
              <ClipboardList size={39} className="mb-4 text-[#9bb0c8]"/>
              <h3 className="text-base font-black text-[#163a65]">Stok hareketlerini görüntüle</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                Soldaki listeden ürün seçin. Alış, satış, iade ve manuel stok işlemleri ürünün kendi sayfasında görünecek.
              </p>
            </div>
          ) : (
            <>
              <div className={cardStyle + " p-4 sm:p-5"}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-sky-700">ÜRÜN STOK KARTI</p>
                    <h3 className="mt-1 text-lg font-black text-[#112e52]">{ledger?.product.name || selected?.name || "Ürün"}</h3>
                    <p className="mt-1 text-xs text-slate-500">Stok kodu: {ledger?.product.sku || selected?.sku || "—"}</p>
                  </div>
                  <button type="button" onClick={reload} disabled={loading}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#dce7f4] bg-white px-3 py-2.5 text-xs font-semibold text-[#235d91] disabled:opacity-50">
                    <RefreshCw size={15}/> Yenile
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Metric label="Güncel Stok" value={qty(ledger?.product.stock ?? selected?.stock)} icon={<Package size={17}/>} />
                  <Metric label="Toplam Alınan" value={qty(ledger?.stats.purchased ?? 0)} icon={<Truck size={17}/>} />
                  <Metric label="Toplam Satılan" value={qty(ledger?.stats.sold ?? 0)} icon={<ShoppingBag size={17}/>} />
                  <Metric label="Hareket Sayısı" value={qty(ledger?.stats.total ?? 0)} icon={<History size={17}/>} />
                </div>
                {ledger && Math.abs(Number(ledger.stats.unrecorded_balance)) > 0.00001 && (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[11px] leading-5 text-amber-800">
                    Kayıtlı hareketler dışındaki stok farkı: <strong>{qty(ledger.stats.unrecorded_balance)} adet.</strong>
                    Bu tutar eski sistemden aktarılan başlangıç stoğunu veya harici stok değişikliklerini içerebilir;
                    tarih ve alış fiyatı bilinmeyen işlemler için hareket oluşturulmaz.
                  </p>
                )}
              </div>

              {canManage && (
                <form onSubmit={adjust} className={cardStyle + " space-y-3 p-4 sm:p-5"}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="flex items-center gap-2 text-sm font-extrabold text-[#183a60]">
                      <SlidersHorizontal size={18}/> Manuel Stok Yönetimi
                    </h4>
                    <span className="text-[11px] text-slate-400">Her işlem hareket geçmişine kaydedilir.</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => changeAdjustment("mode","in")}
                      aria-pressed={mode === "in"}
                      className={"flex min-h-11 items-center justify-center gap-2 rounded-xl border text-sm font-bold "+
                        (mode === "in"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-500")}>
                      <ArrowDownCircle size={18}/> Stok Ekle
                    </button>
                    <button type="button" onClick={() => changeAdjustment("mode","out")}
                      aria-pressed={mode === "out"}
                      className={"flex min-h-11 items-center justify-center gap-2 rounded-xl border text-sm font-bold "+
                        (mode === "out"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-slate-200 bg-white text-slate-500")}>
                      <ArrowUpCircle size={18}/> Stok Çıkar
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[170px_minmax(0,1fr)]">
                    <label className="min-w-0">
                      <span className="mb-1.5 block text-xs font-semibold text-slate-600">Miktar (adet)</span>
                      <input type="number" min="0.001" max="999999999" step="0.001" required
                        value={amount} onChange={e => changeAdjustment("amount",e.target.value)}
                        placeholder="Örn. 12" className={fieldStyle}/>
                    </label>
                    <label className="min-w-0">
                      <span className="mb-1.5 block text-xs font-semibold text-slate-600">İşlem açıklaması</span>
                      <input maxLength={500} minLength={3} required value={note} onChange={e => changeAdjustment("note",e.target.value)}
                        placeholder="Sayım düzeltmesi, hasarlı ürün, stok girişi..."
                        className={fieldStyle}/>
                    </label>
                  </div>
                  {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
                  {notice && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{notice}</p>}
                  <button type="submit" disabled={busy || !amount || note.trim().length < 3}
                    className={"inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-45 "+
                      (mode === "in" ? "bg-[#126e57] hover:bg-[#07563e]" : "bg-[#b43636] hover:bg-[#912626]")}>
                    {busy ? "Kaydediliyor…" : mode === "in" ? "Stoğa Ekle ve Kaydet" : "Stoktan Çıkar ve Kaydet"}
                  </button>
                </form>
              )}

              <div className={cardStyle + " overflow-hidden"}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7edf6] px-4 py-4 sm:px-5">
                  <h4 className="flex items-center gap-2 text-sm font-extrabold text-[#18385f]">
                    <CalendarDays size={17}/> Alış / Satış / Stok Geçmişi
                  </h4>
                  <span className="text-xs font-medium text-slate-500">{ledger?.historyTotal ?? 0} kayıt · {ledger?.stats.total ?? 0} geçerli hareket</span>
                </div>
                {error && !canManage && (
                  <div role="alert" className="m-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</div>
                )}
                {loading && !ledger && (
                  <div className="px-4 py-12 text-center text-sm text-slate-500">Stok hareketleri yükleniyor…</div>
                )}
                {!loading && ledger && ledger.entries.length === 0 && (
                  <div className="p-8 text-center">
                    <History size={31} className="mx-auto mb-3 text-slate-300"/>
                    <p className="text-sm font-bold text-slate-600">Bu ürün için kayıtlı stok hareketi bulunmuyor.</p>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      B2B'den aktarılan mevcut stoklar geçmiş alış ve satış belgesi olmadan gelmiş olabilir.
                    </p>
                  </div>
                )}
                {ledger && ledger.entries.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="min-w-[690px] w-full text-left text-xs">
                      <thead className="bg-[#f0f5fb] text-[#617991]">
                        <tr>
                          {["Tarih / Saat", "İşlem Türü", "Stok Değişimi", "Birim Fiyat", "Tutar", "Belge / Açıklama"].map(header =>
                            <th key={header} className="px-3.5 py-3.5 font-bold">{header}</th>)}
                          {canManage&&<th className="min-w-[130px] px-3.5 py-3.5 font-bold">İşlem</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.entries.map(item => {
                          const delta = Number(item.delta);
                          const positive = delta > 0;
                          return (
                            <>
                            <tr key={String(item.id)} className={"border-t border-[#edf2f8] align-top "+(item.voided_at?"bg-slate-50 opacity-75":"")}>
                              <td className="whitespace-nowrap px-3.5 py-3.5 text-[#47617b]">{dateTime(item.created_at)}</td>
                              <td className="px-3.5 py-3.5 font-semibold text-[#18385b]">
                                {movementNames[item.reason] || item.reason}
                                {item.voided_at&&<span className="mt-1 block text-[10px] font-bold text-rose-600">Silindi · Stok etkisi geri alındı</span>}
                                {!item.voided_at&&item.edited_at&&<span className="mt-1 block text-[10px] font-bold text-amber-700">Düzenlendi</span>}
                              </td>
                              <td className={"whitespace-nowrap px-3.5 py-3.5 font-extrabold "+(positive?"text-emerald-700":"text-red-700")+(item.voided_at?" line-through":"")}>
                                {positive?"+":"−"}{qty(Math.abs(delta))}
                              </td>
                              <td className="whitespace-nowrap px-3.5 py-3.5 text-[#18385b]">
                                {item.unit_price == null ? "—" : money(item.unit_price)}
                              </td>
                              <td className="whitespace-nowrap px-3.5 py-3.5 font-semibold text-[#18385b]">
                                {item.line_total == null ? "—" : money(item.line_total)}
                              </td>
                              <td className="max-w-[270px] px-3.5 py-3.5 text-[#546f89]">
                                {item.invoice_no && <div className="font-bold text-[#234f7e]">Fatura #{item.invoice_no}</div>}
                                {item.party_name && <div className="mt-0.5">{item.party_name}</div>}
                                {item.issued_at && <div className="mt-0.5 text-[10px] text-slate-400">Belge tarihi: {String(item.issued_at).slice(0,10)}</div>}
                                {item.note && <div className="mt-0.5 break-words">{item.note}</div>}
                                {!item.invoice_no && !item.note && "Manuel stok işlemi"}
                              </td>
                              {canManage&&<td className="px-3 py-3">
                                <div className="flex flex-wrap gap-1.5">
                                  {item.reason==="adjustment"&&!item.voided_at&&<>
                                    <button type="button" disabled={editingBusy||busy} title="Stok hareketini düzenle"
                                      onClick={()=>startEditing(item)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-[#cfdeee] bg-white px-2 py-1.5 text-[11px] font-bold text-[#235780] disabled:opacity-40">
                                      <Pencil size={13}/> Düzenle
                                    </button>
                                    <button type="button" disabled={editingBusy||busy} title="Stok hareketini sil"
                                      onClick={()=>void removeMovement(item)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-red-50 px-2 py-1.5 text-[11px] font-bold text-red-700 disabled:opacity-40">
                                      <Trash2 size={13}/> Sil
                                    </button>
                                  </>}
                                  {item.reason==="adjustment"&&(item.edited_at||item.voided_at)&&
                                    <button type="button" onClick={()=>void viewAudit(item)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-[#dce5f0] bg-white px-2 py-1.5 text-[11px] font-bold text-slate-600">
                                      <FileClock size={13}/> Kayıt Geçmişi
                                    </button>}
                                  {item.reason!=="adjustment"&&
                                    <span className="text-[10px] leading-5 text-slate-400">Fatura kaynaklı</span>}
                                </div>
                              </td>}
                            </tr>
                            {editing?.id===String(item.id)&&<tr className="border-t border-sky-100 bg-[#f1f8ff]">
                              <td colSpan={canManage?7:6} className="px-3 py-4">
                                <form onSubmit={saveEditedMovement} className="space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs font-extrabold text-[#15385c]">Manuel hareketi düzenle</p>
                                    <button type="button" onClick={()=>setEditing(null)}
                                      className="rounded-lg border border-slate-200 bg-white p-1.5" aria-label="Düzenlemeyi kapat"><X size={14}/></button>
                                  </div>
                                  <div className="grid gap-2 sm:grid-cols-[150px_140px_minmax(0,1fr)]">
                                    <select aria-label="Hareket yönü" className={fieldStyle}
                                      value={editing.direction}
                                      onChange={e=>setEditing(old=>old?{...old,direction:e.target.value as "in"|"out"}:old)}>
                                      <option value="in">Stok Ekle</option>
                                      <option value="out">Stok Çıkar</option>
                                    </select>
                                    <input type="number" required min="0.001" max="999999999" step="0.001"
                                      className={fieldStyle} aria-label="Düzeltilen miktar" value={editing.amount}
                                      onChange={e=>setEditing(old=>old?{...old,amount:e.target.value}:old)}/>
                                    <input required minLength={3} maxLength={500}
                                      className={fieldStyle} aria-label="Düzenleme açıklaması" value={editing.note}
                                      onChange={e=>setEditing(old=>old?{...old,note:e.target.value}:old)}/>
                                  </div>
                                  <p className="text-[11px] text-[#617991]">Değişen miktar stoka işlenir; eski değer denetim geçmişinde kalır.</p>
                                  <button type="submit" disabled={editingBusy}
                                    className="inline-flex items-center gap-2 rounded-xl bg-[#123c66] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
                                    <Check size={15}/> {editingBusy?"Kaydediliyor…":"Değişikliği Kaydet"}
                                  </button>
                                </form>
                              </td>
                            </tr>}
                            {auditMovementId===String(item.id)&&<tr className="border-t border-slate-100 bg-[#f8fafd]">
                              <td colSpan={canManage?7:6} className="px-4 py-4">
                                <p className="mb-2 flex items-center gap-2 text-xs font-extrabold text-[#284c72]">
                                  <ShieldCheck size={14}/> Değişiklik / Silme Denetim Kaydı
                                </p>
                                {auditBusy?<p className="text-xs text-slate-500">Kayıt geçmişi yükleniyor…</p>:
                                  auditRows.length===0?<p className="text-xs text-slate-500">Kayıt bulunamadı.</p>:
                                  <div className="space-y-2">{auditRows.map(a=>
                                    <div key={a.id} className="rounded-lg border border-[#e0e9f4] bg-white p-3 text-[11px] text-slate-700">
                                      <strong>{a.action==="delete"?"Hareket Silindi":"Hareket Düzenlendi"}</strong>
                                      {" · "+dateTime(a.changed_at)+" · "+(a.actor||"Personel")}
                                      <div className="mt-1">Eski: {qty(a.previous_delta)} → Yeni: {qty(a.new_delta)} ·
                                        Stok {qty(a.stock_before)} → {qty(a.stock_after)}</div>
                                      {(a.previous_note||a.new_note)&&
                                        <div className="mt-1">Açıklama: {a.previous_note||"—"} → {a.new_note||"—"}</div>}
                                    </div>
                                  )}</div>}
                              </td>
                            </tr>}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {ledger && ledger.totalPages > 1 && (
                  <div className="flex items-center justify-end gap-3 border-t border-[#edf2f8] px-4 py-3">
                    <button type="button" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value-1))}
                      aria-label="Önceki hareket sayfası"
                      className="rounded-lg border border-[#dbe6f3] px-3 py-2 text-xs font-bold text-[#245984] disabled:opacity-40">
                      Önceki
                    </button>
                    <span className="text-xs font-semibold text-slate-500">{page} / {ledger.totalPages}</span>
                    <button type="button" disabled={page >= ledger.totalPages} onClick={() => setPage(value => value+1)}
                      aria-label="Sonraki hareket sayfası"
                      className="rounded-lg border border-[#dbe6f3] px-3 py-2 text-xs font-bold text-[#245984] disabled:opacity-40">
                      Sonraki
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ChevronRightIcon({active}:{active:boolean}) {
  return <ChevronRight size={17} className={active?"shrink-0 text-sky-700":"shrink-0 text-slate-300"}/>;
}
function Metric({label,value,icon}:{label:string;value:string;icon:ReactNode}) {
  return <div className="rounded-xl border border-[#e3ecf6] bg-[#f8fbff] px-3 py-3">
    <div className="flex items-center gap-1.5 text-[#4c7599]">{icon}<span className="text-[10px] font-semibold">{label}</span></div>
    <div className="mt-2 truncate text-base font-black tabular-nums text-[#15375c]">{value}</div>
  </div>;
}
