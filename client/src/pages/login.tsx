import { FormEvent, useState } from "react";
import { LogIn } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await apiRequest("POST", "/api/auth/login", { username, password });
      window.location.reload();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Giriş yapılamadı");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <img src={BRAND.logo} alt={BRAND.name} className="mx-auto h-16 w-16 rounded-xl object-cover" />
          <div>
            <CardTitle className="text-2xl">{BRAND.name}</CardTitle>
            <CardDescription className="mt-2">Panelinize giriş yapın</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">E-posta / kullanıcı adı</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              <LogIn className="mr-2 h-4 w-4" />
              {isSubmitting ? "Giriş yapılıyor..." : "Giriş yap"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">Yerel panel hesabınızla giriş yapın</p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
