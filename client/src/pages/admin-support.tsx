import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Archive, ArrowLeft, CheckCheck, Copy, Download, FileText, Headset,
  Image as ImageIcon, Loader2, MessageSquare, Paperclip, RefreshCw, Search,
  Send, ShieldCheck, UserRound, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Status = "open" | "answered" | "closed";
type Filter = "all" | Status;
type Ticket = {
  id: string | number;
  user_id?: number | null;
  subject?: string | null;
  message?: string | null;
  status?: string | null;
  customer_name?: string | null;
  customer_company_name?: string | null;
  customer_first_name?: string | null;
  customer_last_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_category?: string | null;
  customer_tax_office?: string | null;
  customer_tax_number?: string | null;
  customer_address?: string | null;
  customer_district?: string | null;
  customer_city?: string | null;
  customer_registered_at?: string | null;
  reply_count?: number;
  last_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
type SupportMessage = {
  id: string | number;
  ticket_id: string | number;
  sender_role: "admin" | "customer";
  message: string;
  created_at?: string | null;
  attachment_id?: number | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
};
type Conversation = { ticket: Ticket; messages: SupportMessage[] };
type AdminUser = { role: string };
const filters: { key: Filter; title: string }[] = [
  { key: "all", title: "Tümü" },
  { key: "open", title: "Açık" },
  { key: "answered", title: "Yanıtlandı" },
  { key: "closed", title: "Sohbet Arşivi" },
];
const allowedMime: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  pdf: "application/pdf", txt: "text/plain",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const allowedTypes = new Set(Object.values(allowedMime));
const limitBytes = 5 * 1024 * 1024;

function statusOf(status?: string | null): Status {
  if (["closed", "resolved", "done"].includes(String(status || "").toLowerCase())) return "closed";
  if (["answered", "replied"].includes(String(status || "").toLowerCase())) return "answered";
  return "open";
}
function statusTitle(status?: string | null) {
  const statusKey = statusOf(status);
  return statusKey === "closed" ? "Kapalı" : statusKey === "answered" ? "Yanıtlandı" : "Açık";
}
function statusClass(status?: string | null) {
  const key = statusOf(status);
  return key === "closed"
    ? "bg-muted text-muted-foreground"
    : key === "answered"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : "bg-amber-500/10 text-amber-700 dark:text-amber-400";
}
function customerName(ticket: Ticket) {
  return ticket.customer_company_name || ticket.customer_name ||
    [ticket.customer_first_name, ticket.customer_last_name].filter(Boolean).join(" ") ||
    ticket.customer_email || "Müşteri";
}
function formatDate(input?: string | null) {
  if (!input) return "—";
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || body.message || "Destek bilgileri alınamadı.");
  }
  return response.json() as Promise<T>;
}
function errorMessage(error: unknown, fallback = "İşlem tamamlanamadı.") {
  return error instanceof Error ? error.message : fallback;
}
function attachmentUrl(ticketId: string, fileId: number) {
  return "/api/admin/b2b-support/" + encodeURIComponent(ticketId) +
    "/attachments/" + encodeURIComponent(String(fileId));
}
function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Dosya okunamadı."));
    reader.onload = () => {
      if (typeof reader.result !== "string" || !reader.result.includes(",")) {
        reject(new Error("Dosya okunamadı."));
      } else {
        resolve(reader.result.slice(reader.result.indexOf(",") + 1));
      }
    };
    reader.readAsDataURL(file);
  });
}

export default function AdminSupport() {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const archive = filter === "closed";

  const { data: admin } = useQuery<AdminUser>({
    queryKey: ["/api/auth/me"],
  });
  const isSuperAdmin = admin?.role === "super_admin";
  const inbox = useQuery<Ticket[]>({
    queryKey: ["admin-support-inbox", archive],
    queryFn: () => getJson<Ticket[]>("/api/admin/b2b-support" + (archive ? "?view=archive" : "")),
    enabled: !archive || isSuperAdmin,
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
  });
  const detail = useQuery<Conversation>({
    queryKey: ["admin-support-conversation", selectedId],
    queryFn: () => getJson<Conversation>("/api/admin/b2b-support/" + encodeURIComponent(selectedId!)),
    enabled: !!selectedId,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const tickets = inbox.data || [];
  const counts = useMemo(() => ({
    open: tickets.filter((ticket) => statusOf(ticket.status) === "open").length,
    answered: tickets.filter((ticket) => statusOf(ticket.status) === "answered").length,
  }), [tickets]);
  const filteredTickets = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr-TR");
    return tickets.filter((ticket) =>
      (archive || filter === "all" || statusOf(ticket.status) === filter) &&
      (!term || [
        ticket.id, ticket.subject, ticket.message, ticket.last_message,
        ticket.customer_name, ticket.customer_email, ticket.customer_phone,
      ].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR").includes(term)),
    );
  }, [tickets, filter, archive, search]);

  const ticket = selectedId === String(detail.data?.ticket.id) ? detail.data?.ticket : undefined;
  const messages: SupportMessage[] = ticket ? [
    { id: "initial", ticket_id: ticket.id, sender_role: "customer",
      message: ticket.message || "", created_at: ticket.created_at },
    ...(detail.data?.messages || []),
  ] : [];

  useEffect(() => {
    if (selectedId && messagesRef.current && ticket) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [selectedId, ticket?.id, messages.length]);

  function selectTicket(id: string) {
    setSelectedId(id);
    setDraft("");
    setError("");
    setProfileOpen(false);
  }
  function changeFilter(next: Filter) {
    if (next === "closed" && !isSuperAdmin) return;
    setFilter(next);
    setSelectedId(null);
    setProfileOpen(false);
    setDraft("");
    setError("");
  }
  async function refresh() {
    setError("");
    await Promise.all([inbox.refetch(), selectedId ? detail.refetch() : Promise.resolve()]);
  }
  async function refreshAll(id: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-support-inbox"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-support-conversation", id] }),
    ]);
  }
  async function reply() {
    const id = selectedId;
    const message = draft.trim();
    if (!id || !ticket || statusOf(ticket.status) === "closed" || busy || message.length < 2 || message.length > 4000) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest("POST", "/api/admin/b2b-support/" + encodeURIComponent(id) + "/messages", { message });
      setDraft("");
      await refreshAll(id);
    } catch (cause) {
      setError(errorMessage(cause, "Yanıt gönderilemedi."));
    } finally {
      setBusy(false);
    }
  }
  async function updateStatus(next: "closed" | "open") {
    const id = selectedId;
    if (!id || busy || !isSuperAdmin) return;
    if (next === "closed" && !window.confirm("Görüşme sonlandırılsın mı? Talep yönetici arşivine taşınacaktır.")) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest("PATCH", "/api/admin/b2b-support/" + encodeURIComponent(id) + "/status", { status: next });
      setSelectedId(null);
      setProfileOpen(false);
      setDraft("");
      setFilter(next === "closed" ? "closed" : "all");
      await queryClient.invalidateQueries({ queryKey: ["admin-support-inbox"] });
      queryClient.removeQueries({ queryKey: ["admin-support-conversation", id] });
    } catch (cause) {
      setError(errorMessage(cause, "Talep durumu değiştirilemedi."));
    } finally {
      setBusy(false);
    }
  }
  async function uploadAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const id = selectedId;
    if (!file || !id || !ticket || busy || statusOf(ticket.status) === "closed") return;
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const mime = allowedMime[extension];
    if (!mime || !allowedTypes.has(mime) || (file.type && file.type !== mime)) {
      setError("Yalnızca JPG, PNG, WEBP, PDF, TXT, DOCX veya XLSX dosyası seçebilirsiniz.");
      return;
    }
    if (file.size > limitBytes || file.size === 0) {
      setError("Dosya boş olmamalı ve 5 MB sınırını aşmamalıdır.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const base64 = await fileBase64(file);
      await apiRequest("POST", "/api/admin/b2b-support/" + encodeURIComponent(id) + "/attachments", {
        fileName: file.name, mimeType: mime, base64, message: draft.trim().slice(0, 1000),
      });
      setDraft("");
      await refreshAll(id);
    } catch (cause) {
      setError(errorMessage(cause, "Dosya gönderilemedi."));
    } finally {
      setBusy(false);
    }
  }
  async function downloadAttachment(file: SupportMessage) {
    if (!selectedId || !file.attachment_id) return;
    setError("");
    try {
      const response = await fetch(attachmentUrl(selectedId, file.attachment_id), {
        credentials: "include", cache: "no-store",
      });
      if (!response.ok) throw new Error("Dosya açılamadı veya erişim izniniz yok.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.attachment_name || "destek-dosyasi";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(errorMessage(cause, "Dosya indirilemedi."));
    }
  }
  const profileFields: Array<[string, string | number | null | undefined]> = ticket ? [
    ["Firma", ticket.customer_company_name],
    ["Yetkili", [ticket.customer_first_name, ticket.customer_last_name].filter(Boolean).join(" ")],
    ["Telefon", ticket.customer_phone],
    ["E-posta", ticket.customer_email],
    ["Sektör", ticket.customer_category],
    ["Vergi dairesi", ticket.customer_tax_office],
    ["Vergi numarası", ticket.customer_tax_number],
    ["Adres", [ticket.customer_address, ticket.customer_district, ticket.customer_city].filter(Boolean).join(", ")],
    ["Üyelik tarihi", formatDate(ticket.customer_registered_at)],
    ["Müşteri numarası", ticket.user_id],
  ] : [];

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Headset className="h-6 w-6" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Destek Merkezi</h1>
            <p className="text-xs text-muted-foreground">Çalışkan B2B müşteri görüşmeleri · Mobil uygulama ile senkronize</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={inbox.isFetching || detail.isFetching}>
          <RefreshCw className={"mr-2 h-4 w-4 " + (inbox.isFetching ? "animate-spin" : "")} />Yenile
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[345px_minmax(0,1fr)]">
        <aside className={(selectedId ? "hidden lg:flex " : "flex ") + "min-h-0 flex-col border-r bg-muted/15"}>
          <div className="shrink-0 space-y-3 border-b p-3.5">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder="Müşteri, konu veya talep no ara" className="pl-9" aria-label="Destek görüşmesi ara" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {filters.filter((f) => f.key !== "closed" || isSuperAdmin).map((f) => (
                <button key={f.key} type="button" onClick={() => changeFilter(f.key)}
                  className={"rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors " +
                    (filter === f.key ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>
                  {f.key === "closed" ? <Archive className="mr-1 inline-block h-3.5 w-3.5" /> : null}
                  {f.title}
                  {f.key === "open" && !archive ? " (" + counts.open + ")" : ""}
                  {f.key === "answered" && !archive ? " (" + counts.answered + ")" : ""}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {inbox.isLoading ? (
              <div className="p-6 text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Görüşmeler yükleniyor…</div>
            ) : inbox.error ? (
              <div className="p-5 text-sm text-destructive">
                {errorMessage(inbox.error, "Görüşmeler yüklenemedi.")}
                <Button size="sm" variant="outline" className="mt-3 block" onClick={() => void inbox.refetch()}>Tekrar dene</Button>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Bu bölümde görüşme bulunmuyor.</div>
            ) : filteredTickets.map((item) => (
              <button type="button" key={String(item.id)} onClick={() => selectTicket(String(item.id))}
                className={"w-full border-b px-4 py-4 text-left transition-colors hover:bg-muted/70 " +
                  (selectedId === String(item.id) ? "bg-primary/10" : "")}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{customerName(item)}</span>
                  <span className={"shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium " + statusClass(item.status)}>{statusTitle(item.status)}</span>
                </div>
                <p className="truncate text-xs font-medium">{item.subject || "Destek Talebi"} · #{item.id}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.last_message || item.message || "Mesaj bulunmuyor"}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">{formatDate(item.updated_at || item.created_at)}</p>
              </button>
            ))}
          </div>
          <div className="shrink-0 border-t p-3 text-xs text-muted-foreground">
            {filteredTickets.length} görüşme · Otomatik yenileme açık
          </div>
        </aside>

        <section className={(selectedId ? "flex " : "hidden lg:flex ") + "min-h-0 min-w-0 flex-col"}>
          {!selectedId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 opacity-35" />
              <h2 className="text-base font-semibold text-foreground">Bir destek görüşmesi seçin</h2>
              <p className="max-w-xs text-sm">Müşteri bilgilerini, mesajları ve dosyaları bu ekranda yönetin.</p>
            </div>
          ) : (
            <>
              <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
                <button type="button" className="rounded-lg p-1.5 hover:bg-muted lg:hidden"
                  aria-label="Görüşme listesine dön" onClick={() => { setSelectedId(null); setProfileOpen(false); setError(""); }}>
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold">{ticket ? customerName(ticket) : "Görüşme #" + selectedId}</h2>
                  <p className="truncate text-xs text-muted-foreground">{ticket?.subject || "Destek görüşmesi"} · #{selectedId}</p>
                </div>
                {ticket && (
                  <span className={"rounded-lg px-2 py-1 text-xs font-semibold " + statusClass(ticket.status)}>{statusTitle(ticket.status)}</span>
                )}
                <Button variant="outline" size="sm" onClick={() => setProfileOpen((value) => !value)} disabled={!ticket}
                  aria-expanded={profileOpen} aria-controls="support-profile">
                  <UserRound className="mr-1 h-4 w-4" />Bilgiler
                </Button>
              </div>

              {error && <div role="alert" className="mx-4 mt-3 flex items-start justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <span>{error}</span>
                <button type="button" aria-label="Hatayı kapat" onClick={() => setError("")}><X className="h-4 w-4" /></button>
              </div>}
              {detail.error && <div role="alert" className="m-4 text-sm text-destructive">{errorMessage(detail.error, "Görüşme açılamadı.")}</div>}

              {profileOpen && ticket && (
                <div id="support-profile" className="max-h-60 shrink-0 overflow-y-auto border-b bg-muted/25 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" />Müşteri / Firma Bilgileri</div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {profileFields.map(([key, value]) => (
                      <div key={key} className="flex min-w-0 items-center gap-2 rounded-lg border bg-background px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-muted-foreground">{key}</p>
                          <p className="break-words text-xs font-medium">{value || "—"}</p>
                        </div>
                        {value && <button type="button" className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
                          title={key + " kopyala"} onClick={() => void navigator.clipboard?.writeText(String(value))}>
                          <Copy className="h-3.5 w-3.5" />
                        </button>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/10 p-4 sm:p-6">
                {detail.isLoading && !ticket ? <p className="text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Mesajlar yükleniyor…</p> : null}
                {ticket && (
                  <>
                    <div className="mx-auto max-w-fit rounded-full border bg-background px-3 py-1 text-center text-xs text-muted-foreground">
                      {ticket.subject || "Destek Talebi"} · {formatDate(ticket.created_at)}
                    </div>
                    {messages.map((message) => {
                      const mine = message.sender_role === "admin";
                      const image = !!message.attachment_id && !!message.attachment_mime?.startsWith("image/");
                      return (
                        <div key={String(message.id)} className={"flex " + (mine ? "justify-end" : "justify-start")}>
                          <div className={"max-w-[92%] space-y-2 rounded-2xl border px-3.5 py-3 text-sm shadow-sm sm:max-w-[78%] " +
                            (mine ? "border-primary/20 bg-primary/10" : "bg-background")}>
                            <p className="text-xs font-semibold">{mine ? "Çalışkan B2B" : customerName(ticket)}</p>
                            {image && message.attachment_id && (
                              <button type="button" onClick={() => void downloadAttachment(message)} className="block max-w-full overflow-hidden rounded-lg border"
                                title="Görseli indir">
                                <img className="max-h-64 max-w-full object-contain"
                                  src={attachmentUrl(selectedId, message.attachment_id)}
                                  alt={message.attachment_name || "Destek görseli"} loading="lazy" />
                              </button>
                            )}
                            {message.attachment_id && (
                              <button type="button" onClick={() => void downloadAttachment(message)}
                                className="flex max-w-full items-center gap-2 rounded-lg border bg-background p-2 text-left text-xs hover:bg-muted">
                                {image ? <ImageIcon className="h-4 w-4 shrink-0" /> : <FileText className="h-4 w-4 shrink-0" />}
                                <span className="min-w-0 flex-1 break-all">{message.attachment_name || "Ek dosya"}</span>
                                <Download className="h-4 w-4 shrink-0" />
                              </button>
                            )}
                            {message.message && <p className="whitespace-pre-wrap break-words">{message.message}</p>}
                            <p className="text-right text-[10px] text-muted-foreground">{formatDate(message.created_at)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {ticket && statusOf(ticket.status) === "closed" ? (
                <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground"><Archive className="mr-2 inline h-4 w-4" />Bu görüşme sonlandırıldı.</p>
                  {isSuperAdmin && <Button variant="outline" size="sm" disabled={busy} onClick={() => void updateStatus("open")}>
                    <RefreshCw className="mr-2 h-4 w-4" />Yeniden Aç
                  </Button>}
                </div>
              ) : ticket ? (
                <div className="shrink-0 space-y-2 border-t bg-background p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Müşteriye yanıt yazın · {draft.length}/4000</span>
                    {isSuperAdmin && <Button variant="ghost" size="sm" onClick={() => void updateStatus("closed")} disabled={busy}>
                      <CheckCheck className="mr-1 h-4 w-4" />Talebi Kapat
                    </Button>}
                  </div>
                  <Textarea value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 4000))}
                    aria-label="Destek yanıtı" placeholder="Mesaj yazın… (Ctrl + Enter ile gönder)"
                    rows={2} maxLength={4000} disabled={busy}
                    onKeyDown={(event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void reply(); } }} />
                  <div className="flex items-center justify-between gap-2">
                    <input ref={fileInputRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.docx,.xlsx"
                      onChange={(event) => void uploadAttachment(event)} aria-label="Destek eki seç" />
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                      <Paperclip className="mr-2 h-4 w-4" />Dosya / Görsel Ekle
                    </Button>
                    <Button size="sm" disabled={busy || draft.trim().length < 2} onClick={() => void reply()}>
                      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Yanıtı Gönder
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Dosyalar en fazla 5 MB olabilir. Eklenirken yazılı mesajınız da iletilir.</p>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
