import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, LockKeyhole, Mail, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { BRAND } from "@/lib/brand";

export default function B2BRegister() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (password !== passwordAgain) {
      setError("Şifreler eşleşmiyor");
      return;
    }

    setBusy(true);
    try {
      await apiRequest("POST", "/api/b2b/register", {
        email: email.trim(),
        password,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt oluşturulamadı");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] px-4 py-8">
      <div className="mx-auto max-w-md">
        <Link href="/uye-girisi" className="mb-5 inline-flex items-center text-sm text-slate-500 hover:text-slate-950">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Giriş ekranına dön
        </Link>

        <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b p-7">
            <img src={BRAND.logoLarge} alt="Çalışkan B2B" className="h-14 w-14 rounded-xl object-cover" />
            <div>
              <div className="text-xl font-black">Çalışkan B2B</div>
              <div className="text-sm text-slate-500">Yeni Müşteri Kaydı</div>
            </div>
          </div>

          {done ? (
            <div className="p-7 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <h1 className="mt-4 text-xl font-black">Kaydınız alındı</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Hesabınız yönetici onayından sonra aktif olacaktır.
              </p>
              <Button asChild className="mt-6 w-full bg-slate-950 hover:bg-slate-800">
                <Link href="/uye-girisi">Giriş ekranına dön</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5 p-7">
              <div className="space-y-2">
                <Label htmlFor="register-email">E-posta</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="register-email"
                    type="email"
                    autoComplete="email"
                    className="h-11 pl-9"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-password">Şifre</Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="register-password"
                    type="password"
                    autoComplete="new-password"
                    className="h-11 pl-9"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-password-again">Şifre Tekrar</Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="register-password-again"
                    type="password"
                    autoComplete="new-password"
                    className="h-11 pl-9"
                    value={passwordAgain}
                    onChange={(event) => setPasswordAgain(event.target.value)}
                    minLength={8}
                    required
                  />
                </div>
              </div>

              {error ? (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
              ) : null}

              <Button type="submit" className="h-11 w-full bg-slate-950 hover:bg-slate-800" disabled={busy}>
                <UserPlus className="mr-2 h-4 w-4" />
                {busy ? "Kayıt oluşturuluyor…" : "Kayıt Ol"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
