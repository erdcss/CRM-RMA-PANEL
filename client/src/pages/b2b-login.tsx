import { FormEvent, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, LogIn, Mail, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { BRAND } from "@/lib/brand";
import { useBranding } from "@/hooks/use-branding";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { B2BRegistrationForm } from "@/components/b2b-registration-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function B2BLogin() {
  const { data: branding } = useBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [passwordSetupOpen, setPasswordSetupOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordAgain, setNewPasswordAgain] = useState("");
  const [passwordSetupError, setPasswordSetupError] = useState("");
  const [passwordSetupBusy, setPasswordSetupBusy] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/auth/me", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{
          role?: string;
          isActive?: boolean;
          mustChangePassword?: boolean;
        }>;
      })
      .then((session) => {
        if (
          active &&
          session?.role === "b2b_customer" &&
          session.isActive &&
          session.mustChangePassword
        ) {
          setPasswordSetupOpen(true);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await apiRequest("POST", "/api/b2b/login", {
        email: email.trim(),
        password,
      });
      const result = await response.json() as { mustChangePassword?: boolean };

      if (result.mustChangePassword) {
        setBusy(false);
        setPassword("");
        setPasswordSetupOpen(true);
        return;
      }

      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş yapılamadı");
      setBusy(false);
    }
  }

  async function saveInitialPassword(event: FormEvent) {
    event.preventDefault();
    setPasswordSetupError("");

    if (newPassword.length < 8) {
      setPasswordSetupError("Yeni şifre en az 8 karakter olmalı");
      return;
    }
    if (newPassword !== newPasswordAgain) {
      setPasswordSetupError("Şifreler eşleşmiyor");
      return;
    }

    setPasswordSetupBusy(true);
    try {
      await apiRequest("POST", "/api/b2b/change-initial-password", {
        password: newPassword,
        passwordAgain: newPasswordAgain,
      });
      window.location.assign("/");
    } catch (err) {
      setPasswordSetupError(err instanceof Error ? err.message : "Şifre oluşturulamadı");
      setPasswordSetupBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] px-4 py-6">
      <div className="mx-auto max-w-sm">
        <Link href="/" className="mb-4 inline-flex items-center text-sm text-slate-500 hover:text-slate-950">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Mağazaya dön
        </Link>

        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b p-5">
            <img src={branding?.b2b_logo || BRAND.logoLarge} alt="Çalışkan B2B" className="h-12 w-12 rounded-lg object-cover" />
            <div>
              <div className="text-lg font-black">Çalışkan B2B</div>
              <div className="text-xs text-slate-500">Müşteri Girişi</div>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4 p-5">
            <div className="space-y-2">
              <Label htmlFor="b2b-email">E-posta</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="b2b-email"
                  type="email"
                  autoComplete="email"
                  className="h-10 pl-9"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="b2b-password">Şifre</Label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="b2b-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="h-10 pl-9 pr-10"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
            ) : null}

            <Button type="submit" className="h-10 w-full bg-slate-950 hover:bg-slate-800" disabled={busy}>
              <LogIn className="mr-2 h-4 w-4" />
              {busy ? "Giriş yapılıyor…" : "Giriş Yap"}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-10 w-full"
              onClick={() => setRegisterOpen(true)}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Kayıt Ol
            </Button>
          </form>
        </div>
      </div>

      <Sheet open={registerOpen} onOpenChange={setRegisterOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-0 sm:max-w-xl"
        >
          <SheetHeader className="border-b px-6 py-6 pr-12 text-left sm:px-8">
            <SheetTitle className="text-xl font-black">Firma hesabı oluştur</SheetTitle>
            <SheetDescription>
              B2B üyelik başvurunuzu tamamlayın. Vergi numarası girildiğinde doğrulama otomatik başlar.
            </SheetDescription>
          </SheetHeader>
          <div className="pt-6">
            <B2BRegistrationForm />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={passwordSetupOpen} onOpenChange={() => undefined}>
        <DialogContent className="inset-auto left-1/2 top-1/2 h-auto min-h-0 max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 [&>button]:hidden">
          <DialogHeader>
            <DialogTitle>Yeni şifrenizi oluşturun</DialogTitle>
            <DialogDescription>
              E-postanıza gönderilen tek kullanımlık şifre ile giriş yaptınız. Devam etmek için kalıcı şifrenizi belirleyin.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={saveInitialPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="initial-new-password">Yeni şifre</Label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="initial-new-password"
                  type="password"
                  autoComplete="new-password"
                  className="h-10 pl-9"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  minLength={8}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="initial-new-password-again">Yeni şifre tekrar</Label>
              <Input
                id="initial-new-password-again"
                type="password"
                autoComplete="new-password"
                className="h-11"
                value={newPasswordAgain}
                onChange={(event) => setNewPasswordAgain(event.target.value)}
                minLength={8}
                required
              />
            </div>

            {passwordSetupError ? (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {passwordSetupError}
              </div>
            ) : null}

            <Button
              type="submit"
              className="h-10 w-full bg-slate-950 hover:bg-slate-800"
              disabled={passwordSetupBusy}
            >
              {passwordSetupBusy ? "Şifre oluşturuluyor…" : "Yeni Şifreyi Kaydet"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
