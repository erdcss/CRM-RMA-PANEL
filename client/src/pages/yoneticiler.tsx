import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, UsersRound } from "lucide-react";

import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type BusinessUser = {
  id: string;
  email?: string;
  role: string;
  appAccess: string;
  isActive: boolean;
  createdAt?: string;
};

export default function Yoneticiler() {
  const { data: users = [], isLoading, error } = useQuery<BusinessUser[]>({
    queryKey: ["/api/admin/business-users"],
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  async function createManager(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      await apiRequest("POST", "/api/admin/business-users", { email, password });
      setEmail("");
      setPassword("");
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/business-users"] });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Hesap oluşturulamadı");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleUser(user: BusinessUser, isActive: boolean) {
    await apiRequest("PATCH", `/api/admin/business-users/${user.id}`, { isActive });
    await queryClient.invalidateQueries({ queryKey: ["/api/admin/business-users"] });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b p-4">
        <h1 className="text-2xl font-bold">Yönetici Hesapları</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Çalışkan Business uygulamasına giriş yapacak yönetici hesaplarını buradan atayın.
        </p>
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="mx-auto max-w-5xl space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                <CardTitle>Yeni yönetici</CardTitle>
              </div>
              <CardDescription>
                Oluşturulan hesap yalnızca Çalışkan Business yönetici erişimiyle etiketlenir.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={createManager}>
                <div className="space-y-2">
                  <Label htmlFor="business-email">E-posta</Label>
                  <Input
                    id="business-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-password">Geçici şifre</Label>
                  <Input
                    id="business-password"
                    type="password"
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <Button className="self-end" type="submit" disabled={submitting}>
                  {submitting ? "Oluşturuluyor..." : "Hesap oluştur"}
                </Button>
              </form>
              {formError && <p className="mt-3 text-sm text-destructive">{formError}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <UsersRound className="h-5 w-5" />
                <CardTitle>Çalışkan Business yöneticileri</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading && <p className="text-sm text-muted-foreground">Hesaplar yükleniyor...</p>}
              {error && <p className="text-sm text-destructive">Yönetici hesapları görüntülenemedi.</p>}
              {!isLoading && !error && users.length === 0 && (
                <p className="text-sm text-muted-foreground">Henüz atanmış yönetici hesabı yok.</p>
              )}
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{user.email || user.id}</p>
                    <p className="text-xs text-muted-foreground">Çalışkan Business · Yönetici</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{user.isActive ? "Aktif" : "Pasif"}</span>
                    <Switch
                      checked={user.isActive}
                      onCheckedChange={(checked) => toggleUser(user, checked)}
                      aria-label={`${user.email || "Yönetici"} hesabını aktif/pasif yap`}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
