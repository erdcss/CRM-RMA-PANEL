import { useState } from "react";
import { Link } from "wouter";
import { Eye, EyeOff } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function SignupPage() {
  const { signUp } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast({ title: "Eksik bilgi", description: "E-posta ve şifre girin.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Zayıf şifre", description: "Şifre en az 6 karakter olmalı.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Şifre uyuşmuyor", description: "Şifre tekrarı eşleşmiyor.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await signUp(email, password);
      toast({
        title: "Kayıt başarılı",
        description: "Hesabınız oluşturuldu.",
      });
    } catch (error) {
      toast({
        title: "Kayıt başarısız",
        description: error instanceof Error ? error.message : "Hesap oluşturulamadı.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <img src="/logo.png" alt="Çalışkan RMA" className="h-20 w-20 mx-auto object-contain" />
          <div>
            <CardTitle className="text-2xl">Kaydol</CardTitle>
            <CardDescription>Çalışkan RMA hesabınızı oluşturun</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@caliskangroup.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Şifre Tekrar</Label>
              <Input
                id="confirm"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Kaydediliyor…" : "Hesap Oluştur"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Zaten hesabınız var mı?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Giriş yapın
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
