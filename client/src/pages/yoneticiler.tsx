import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type ManagedUser = {
  id: number;
  username: string;
  role: string;
  appAccess: string;
  isActive: boolean;
};

export default function Yoneticiler() {
  const { data: users = [] } = useQuery<ManagedUser[]>({ queryKey: ["/api/admin/users"] });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function createUser(event: FormEvent) {
    event.preventDefault();
    await apiRequest("POST", "/api/admin/users", {
      username,
      password,
      role: "admin",
      appAccess: "business",
      isActive: true,
    });
    setUsername("");
    setPassword("");
    queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
  }

  async function setActive(user: ManagedUser, isActive: boolean) {
    await apiRequest("PATCH", `/api/admin/users/${user.id}`, { isActive });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b p-4">
        <h1 className="text-2xl font-bold">Yönetici Hesapları</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Çalışkan Business uygulamasına giriş yapacak yönetici hesaplarını buradan atayın.
        </p>
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Yeni yönetici hesabı</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={createUser}>
              <div className="space-y-2">
                <Label htmlFor="manager-username">Kullanıcı adı / e-posta</Label>
                <Input id="manager-username" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manager-password">Geçici şifre</Label>
                <Input id="manager-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button className="self-end" type="submit">Hesap oluştur</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atanmış hesaplar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">{user.username}</div>
                  <div className="text-xs text-muted-foreground">
                    {user.role} · {user.appAccess === "business" ? "Çalışkan Business" : user.appAccess}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{user.isActive ? "Aktif" : "Pasif"}</span>
                  <Switch checked={user.isActive} onCheckedChange={(value) => setActive(user, value)} />
                </div>
              </div>
            ))}
            {users.length === 0 && <p className="text-sm text-muted-foreground">Henüz atanmış yönetici hesabı yok.</p>}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
