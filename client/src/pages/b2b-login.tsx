import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, LockKeyhole, LogIn, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { BRAND } from "@/lib/brand";

export default function B2BLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiRequest("POST", "/api/auth/login", { username: username.trim(), password });
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş yapılamadı");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] px-4 py-8">
      <div className="mx-auto max-w-md">
        <Link href="/" className="mb-5 inline-flex items-center text-sm text-slate-500 hover:text-slate-950">
          <ArrowLeft className="mr-2 h-4 w-4" /> Mağazaya dön
        </Link>

        <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="bg-slate-950 p-7 text-white">
            <div className="flex items-center gap-3">
              <img src={BRAND.logoLarge} alt="Çalışkan B2B" className="h-14 w-14 rounded-xl object-cover" />
              <div>
                <div className="text-xl font-black">Çalışkan B2B</div>
                <div className="text-sm text-slate-300">İşletme Müşteri Girişi</div>
              </div>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-5 p-7">
            <div>
              <h1 className="text-2xl font-black">B2B hesabınıza giriş yapın</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Bu alan yalnızca B2B web sitesi müşterileri içindir. Yönetim paneli girişi ayrı adreste çalışır.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="b2b-user">E-posta / kullanıcı adı</Label>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="b2b-user" className="h-11 pl-9" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="b2b-password">Şifre</Label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="b2b-password" type="password" className="h-11 pl-9" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>

            {error ? <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

            <Button type="submit" className="h-11 w-full bg-slate-950 hover:bg-slate-800" disabled={busy}>
              <LogIn className="mr-2 h-4 w-4" />
              {busy ? "Giriş yapılıyor…" : "Giriş Yap"}
            </Button>

            <div className="rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-500">
              Yönetici girişi: <b>admin.ecalisgan.com</b>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
