import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(() => new URLSearchParams(window.location.search).has("recovery"));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast({ title: "Eksik bilgi", description: "E-posta ve şifre girin.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (error) {
      toast({
        title: "Giriş başarısız",
        description: error instanceof Error ? error.message : "E-posta veya şifre hatalı.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    const recoveryToken = new URLSearchParams(window.location.search).get("recovery") || "";
    if (!email.trim() || !recoveryToken) {
      toast({ title:"Bağlantı geçersiz", description:"Geçerli şifre oluşturma bağlantısını kullanın.", variant:"destructive" });
      return;
    }
    if (newPassword.length < 10 || newPassword !== confirmPassword) {
      toast({ title:"Şifreyi kontrol edin", description:"Şifre en az 10 karakter olmalı ve iki alan eşleşmelidir.", variant:"destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/admin-recovery", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email:email.trim(), password:newPassword, recoveryToken}) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Şifre oluşturulamadı");
      toast({ title:"Şifre oluşturuldu", description:"Ana yönetici hesabınız hazır. Yeni şifrenizle giriş yapabilirsiniz." });
      window.history.replaceState({}, "", "/login");
      setRecoveryMode(false); setPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (error) {
      toast({ title:"İşlem başarısız", description:error instanceof Error ? error.message : "Şifre oluşturulamadı", variant:"destructive" });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-muted/40 p-3 sm:p-6">
      <Card className="w-full max-w-[390px] animate-ui-enter sm:max-w-md">
        <CardHeader className="text-center space-y-2 p-4 pb-2 sm:space-y-4 sm:p-6 sm:pb-3">
          <img src="/api/app-branding/admin/login-logo" alt="Çalışkan" className="h-14 w-14 mx-auto object-contain transition-transform duration-300 hover:scale-105 sm:h-20 sm:w-20 lg:h-24 lg:w-24" onError={(e) => { e.currentTarget.src = "/logo.png"; }} />
          <div>
            <CardTitle className="text-xl sm:text-2xl">Çalışkan Yönetim Paneli</CardTitle>
            <CardDescription>{recoveryMode ? "Ana yönetici şifrenizi oluşturun" : "Yönetici hesabınızla giriş yapın"}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2 sm:p-6 sm:pt-3">
          <form onSubmit={recoveryMode ? handleRecovery : handleSubmit} className="space-y-3 sm:space-y-4">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@caliskangroup.com" />
            </div>
            {recoveryMode ? (
              <>
                <div className="space-y-2"><Label htmlFor="newPassword">Yeni şifre</Label><Input id="newPassword" type="password" autoComplete="new-password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="confirmPassword">Yeni şifre tekrar</Label><Input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} /></div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="password">Şifre</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword((v) => !v)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            <Button type="submit" className="w-full transition-transform duration-150 active:scale-[0.98]" disabled={submitting}>
              {submitting ? "İşleniyor…" : recoveryMode ? "Şifremi Oluştur" : "Giriş Yap"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
