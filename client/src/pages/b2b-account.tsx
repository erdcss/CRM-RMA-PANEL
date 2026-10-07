import { FormEvent, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CreditCard,
  FileText,
  Headphones,
  LockKeyhole,
  LogOut,
  MapPin,
  Plus,
  Pencil,
  RotateCcw,
  Save,
  Settings,
  Trash2,
} from "lucide-react";

import { B2BHeader } from "@/components/b2b-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Tab = "company" | "addresses" | "payments" | "returns" | "invoices" | "support" | "settings";

type Account = {
  id: number;
  email: string | null;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  companyCategory: string | null;
  taxNumber: string | null;
  taxOffice: string | null;
};

type Address = {
  id: number;
  title: string;
  recipient: string | null;
  phone: string | null;
  city: string | null;
  district: string | null;
  address_line: string;
  postal_code: string | null;
  is_default: boolean;
};

const tabs: Array<{ key: Tab; label: string; icon: typeof Building2 }> = [
  { key: "company", label: "Firma Bilgilerim", icon: Building2 },
  { key: "addresses", label: "Kayıtlı Adreslerim", icon: MapPin },
  { key: "payments", label: "Ödeme Bilgilerim", icon: CreditCard },
  { key: "returns", label: "İade İşlemleri", icon: RotateCcw },
  { key: "invoices", label: "Fatura İşlemleri", icon: FileText },
  { key: "support", label: "Destek Hattı", icon: Headphones },
  { key: "settings", label: "Ayarlar", icon: Settings },
];

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (response.status === 401 || response.status === 403) {
    window.location.assign("/uye-girisi");
    throw new Error("Oturum gerekli");
  }
  if (!response.ok) throw new Error("Veri alınamadı");
  return response.json();
}

export default function B2BAccount() {
  const { toast } = useToast();
  const query = new URLSearchParams(window.location.search);
  const requestedTab = query.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(
    requestedTab && tabs.some((item) => item.key === requestedTab)
      ? requestedTab
      : "company",
  );

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <B2BHeader />
      <main className="mx-auto max-w-6xl px-4 py-5 sm:py-6">
        <div className="mb-4">
          <h1 className="text-xl font-black">Hesabım</h1>
          <p className="mt-1 text-sm text-slate-500">Firma hesabınızı ve B2B işlemlerinizi yönetin.</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border bg-white p-2">
            {tabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${tab === item.key ? "bg-slate-950 text-white" : "hover:bg-slate-100"}`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={async () => {
                await apiRequest("POST", "/api/auth/logout");
                queryClient.clear();
                window.location.assign("/");
              }}
              className="mt-2 flex w-full items-center gap-3 border-t px-3 py-3 text-left text-sm font-medium text-slate-500 hover:text-slate-950"
            >
              <LogOut className="h-4 w-4" />
              Çıkış Yap
            </button>
          </aside>

          <section className="min-w-0">
            {tab === "company" ? <CompanyPanel toast={toast} /> : null}
            {tab === "addresses" ? <AddressesPanel toast={toast} /> : null}
            {tab === "payments" ? <PaymentsPanel /> : null}
            {tab === "returns" ? <ReturnsPanel /> : null}
            {tab === "invoices" ? <InvoicesPanel /> : null}
            {tab === "support" ? <SupportPanel toast={toast} /> : null}
            {tab === "settings" ? <SettingsPanel toast={toast} /> : null}
          </section>
        </div>
      </main>
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b p-4 sm:p-5">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

function CompanyPanel({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const { data, isLoading } = useQuery<Account>({
    queryKey: ["/api/b2b/account"],
    queryFn: () => getJson("/api/b2b/account"),
  });
  const [draft, setDraft] = useState<Partial<Account> | null>(null);
  const form = draft || data;

  if (isLoading || !form) return <Panel title="Firma Bilgilerim" description="Firma hesabınız yükleniyor."><div className="text-sm text-slate-500">Yükleniyor…</div></Panel>;

  return (
    <Panel title="Firma Bilgilerim" description="Başvuru sırasında kaydedilen firma bilgilerinizi görüntüleyin ve güncelleyin.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Firma adı"><Input value={form.companyName || ""} onChange={(e) => setDraft({ ...form, companyName: e.target.value })} /></Field>
        <Field label="Firma kategorisi"><Input value={form.companyCategory || ""} onChange={(e) => setDraft({ ...form, companyCategory: e.target.value })} /></Field>
        <Field label="Ad"><Input value={form.firstName || ""} onChange={(e) => setDraft({ ...form, firstName: e.target.value })} /></Field>
        <Field label="Soyad"><Input value={form.lastName || ""} onChange={(e) => setDraft({ ...form, lastName: e.target.value })} /></Field>
        <Field label="E-posta"><Input value={form.email || ""} readOnly className="bg-slate-50" /></Field>
        <Field label="Vergi numarası"><Input value={form.taxNumber || ""} readOnly className="bg-slate-50" /></Field>
        <Field label="Vergi dairesi"><Input value={form.taxOffice || "Otomatik doğrulama bekliyor"} readOnly className="bg-slate-50" /></Field>
      </div>
      <div className="mt-5 flex justify-end">
        <Button
          onClick={async () => {
            try {
              await apiRequest("PATCH", "/api/b2b/account", {
                companyName: form.companyName,
                companyCategory: form.companyCategory,
                firstName: form.firstName,
                lastName: form.lastName,
              });
              await queryClient.invalidateQueries({ queryKey: ["/api/b2b/account"] });
              setDraft(null);
              toast({ title: "Firma bilgileri güncellendi" });
            } catch (error) {
              toast({ title: "Kaydedilemedi", description: error instanceof Error ? error.message : "Hata oluştu", variant: "destructive" });
            }
          }}
        >
          <Save className="mr-2 h-4 w-4" /> Kaydet
        </Button>
      </div>
    </Panel>
  );
}

function AddressesPanel({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const { data = [] } = useQuery<Address[]>({
    queryKey: ["/api/b2b/addresses"],
    queryFn: () => getJson("/api/b2b/addresses"),
  });
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "Teslimat Adresi", recipient: "", phone: "", city: "", district: "", addressLine: "", postalCode: "" });

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest(
        editingId ? "PATCH" : "POST",
        editingId ? `/api/b2b/addresses/${editingId}` : "/api/b2b/addresses",
        form,
      );
      await queryClient.invalidateQueries({ queryKey: ["/api/b2b/addresses"] });
      setOpen(false);
      setEditingId(null);
      setForm({ title: "Teslimat Adresi", recipient: "", phone: "", city: "", district: "", addressLine: "", postalCode: "" });
      toast({ title: editingId ? "Adres güncellendi" : "Adres eklendi" });
    } catch (error) {
      toast({ title: "Adres kaydedilemedi", description: error instanceof Error ? error.message : "Hata oluştu", variant: "destructive" });
    }
  }

  return (
    <Panel title="Kayıtlı Adreslerim" description="Teslimat ve fatura işlemlerinde kullanacağınız adresleri yönetin.">
      <div className="mb-4 flex justify-end">
        <Button
          variant="outline"
          onClick={() => {
            setEditingId(null);
            setForm({ title: "Teslimat Adresi", recipient: "", phone: "", city: "", district: "", addressLine: "", postalCode: "" });
            setOpen((value) => !value);
          }}
        ><Plus className="mr-2 h-4 w-4" /> Yeni Adres</Button>
      </div>

      {open ? (
        <form onSubmit={submit} className="mb-5 grid gap-3 rounded-xl border bg-slate-50 p-4 sm:grid-cols-2">
          <Input placeholder="Adres başlığı" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <Input placeholder="Teslim alacak kişi" value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} />
          <Input placeholder="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input placeholder="İl" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <Input placeholder="İlçe" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
          <Input placeholder="Posta kodu" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
          <div className="sm:col-span-2"><Input placeholder="Açık adres" value={form.addressLine} onChange={(e) => setForm({ ...form, addressLine: e.target.value })} required /></div>
          <div className="sm:col-span-2 flex justify-end"><Button type="submit">{editingId ? "Adresi Güncelle" : "Adresi Kaydet"}</Button></div>
        </form>
      ) : null}

      {data.length === 0 ? <Empty text="Henüz kayıtlı adresiniz yok." /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((address) => (
            <div key={address.id} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{address.title}</div>
                  <div className="mt-2 text-sm text-slate-600">{address.address_line}</div>
                  <div className="mt-1 text-xs text-slate-500">{[address.district, address.city, address.postal_code].filter(Boolean).join(" / ")}</div>
                </div>
                <div className="flex items-center">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(address.id);
                      setForm({
                        title: address.title || "Teslimat Adresi",
                        recipient: address.recipient || "",
                        phone: address.phone || "",
                        city: address.city || "",
                        district: address.district || "",
                        addressLine: address.address_line || "",
                        postalCode: address.postal_code || "",
                      });
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      await apiRequest("DELETE", `/api/b2b/addresses/${address.id}`);
                      await queryClient.invalidateQueries({ queryKey: ["/api/b2b/addresses"] });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function PaymentsPanel() {
  const { data = [] } = useQuery<any[]>({
    queryKey: ["/api/b2b/payment-methods"],
    queryFn: () => getJson("/api/b2b/payment-methods"),
  });
  return (
    <Panel title="Ödeme Bilgilerim" description="Güvenli ödeme sağlayıcınız üzerinden kaydedilmiş ödeme yöntemleri burada görünür.">
      {data.length === 0 ? <Empty text="Henüz kayıtlı ödeme yöntemi yok. Kart numarası gibi hassas bilgiler Çalışkan B2B sunucularında saklanmaz." /> : (
        <div className="space-y-3">{data.map((item) => <div key={item.id} className="rounded-xl border p-4 font-medium">{item.brand || item.provider} •••• {item.last4}</div>)}</div>
      )}
    </Panel>
  );
}

function ReturnsPanel() {
  const { data = [] } = useQuery<any[]>({ queryKey: ["/api/b2b/my-returns"], queryFn: () => getJson("/api/b2b/my-returns") });
  return <Panel title="İade İşlemleri" description="İade taleplerinizi ve mevcut durumlarını takip edin.">{data.length ? <SimpleRows rows={data} /> : <Empty text="Henüz iade işleminiz yok." />}</Panel>;
}

function InvoicesPanel() {
  const { data = [] } = useQuery<any[]>({ queryKey: ["/api/b2b/my-invoices"], queryFn: () => getJson("/api/b2b/my-invoices") });
  return <Panel title="Fatura İşlemleri" description="Hesabınıza ait faturaları görüntüleyin.">{data.length ? <SimpleRows rows={data} /> : <Empty text="Henüz fatura kaydınız yok." />}</Panel>;
}

function SupportPanel({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const { data = [] } = useQuery<any[]>({ queryKey: ["/api/b2b/support"], queryFn: () => getJson("/api/b2b/support") });
  const orderNumber = new URLSearchParams(window.location.search).get("order") || "";
  const [subject, setSubject] = useState(orderNumber ? `Sipariş desteği · ${orderNumber}` : "");
  const [message, setMessage] = useState(
    orderNumber ? `${orderNumber} numaralı siparişim hakkında destek almak istiyorum.` : "",
  );

  return (
    <Panel title="Destek Hattı" description="Sipariş, ürün, iade veya hesap konularında destek talebi oluşturun.">
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await apiRequest("POST", "/api/b2b/support", { subject, message });
            setSubject("");
            setMessage("");
            await queryClient.invalidateQueries({ queryKey: ["/api/b2b/support"] });
            toast({ title: "Destek talebi oluşturuldu" });
          } catch (error) {
            toast({ title: "Talep gönderilemedi", description: error instanceof Error ? error.message : "Hata oluştu", variant: "destructive" });
          }
        }}
      >
        <Input placeholder="Konu" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Mesajınızı yazın"
          className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          required
        />
        <div className="flex justify-end"><Button type="submit">Destek Talebi Gönder</Button></div>
      </form>

      {data.length ? <div className="mt-6"><SimpleRows rows={data} /></div> : null}
    </Panel>
  );
}

function SettingsPanel({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordAgain, setNewPasswordAgain] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  return (
    <div className="space-y-5">
      <Panel title="Şifre Değiştir" description="Hesap güvenliğiniz için güçlü ve benzersiz bir şifre kullanın.">
        <form
          className="grid max-w-xl gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await apiRequest("POST", "/api/b2b/change-password", { currentPassword, newPassword, newPasswordAgain });
              setCurrentPassword(""); setNewPassword(""); setNewPasswordAgain("");
              toast({ title: "Şifreniz değiştirildi" });
            } catch (error) {
              toast({ title: "Şifre değiştirilemedi", description: error instanceof Error ? error.message : "Hata oluştu", variant: "destructive" });
            }
          }}
        >
          <Field label="Mevcut şifre"><Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></Field>
          <Field label="Yeni şifre"><Input type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></Field>
          <Field label="Yeni şifre tekrar"><Input type="password" minLength={8} value={newPasswordAgain} onChange={(e) => setNewPasswordAgain(e.target.value)} required /></Field>
          <div><Button type="submit"><LockKeyhole className="mr-2 h-4 w-4" /> Şifreyi Değiştir</Button></div>
        </form>
      </Panel>

      <Panel title="Hesabımı Sil" description="Bu işlem B2B hesabınızı devre dışı bırakır ve mevcut oturumunuzu kapatır.">
        <div className="max-w-xl space-y-3">
          <Field label="Onay için mevcut şifreniz"><Input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} /></Field>
          <Button
            variant="destructive"
            disabled={!deletePassword}
            onClick={async () => {
              if (!window.confirm("B2B hesabınızı silmek istediğinize emin misiniz?")) return;
              try {
                await apiRequest("DELETE", "/api/b2b/account", { password: deletePassword });
                queryClient.clear();
                window.location.assign("/");
              } catch (error) {
                toast({ title: "Hesap silinemedi", description: error instanceof Error ? error.message : "Hata oluştu", variant: "destructive" });
              }
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Hesabımı Sil
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed bg-slate-50 p-8 text-center text-sm text-slate-500">{text}</div>;
}

function SimpleRows({ rows }: { rows: any[] }) {
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={row.id || index} className="grid gap-1 rounded-xl border p-4 text-sm sm:grid-cols-3">
          <div className="font-semibold">{row.order_number || row.invoice_number || row.subject || `#${row.id}`}</div>
          <div className="text-slate-500">{row.status || row.reason || "Kayıt"}</div>
          <div className="text-slate-500 sm:text-right">{row.created_at ? new Date(row.created_at).toLocaleDateString("tr-TR") : ""}</div>
        </div>
      ))}
    </div>
  );
}
