import type { ReactNode } from "react";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  Clock3,
  Mail,
  RefreshCw,
  ShieldCheck,
  Copy,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Application = {
  id: number;
  username: string;
  email?: string | null;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyCategory?: string | null;
  taxNumber?: string | null;
  taxOffice?: string | null;
  taxVerified: boolean;
  applicationStatus?: "pending" | "approved" | "rejected" | string | null;
  mustChangePassword: boolean;
  isActive: boolean;
  createdAt?: string | null;
  approvedAt?: string | null;
  credentialsSentAt?: string | null;
};

export default function AdminApplications() {
  const { toast } = useToast();
  const [fallbackCredential, setFallbackCredential] = useState<{
    email: string;
    password: string;
    error?: string | null;
  } | null>(null);
  const { data = [], isLoading } = useQuery<Application[]>({
    queryKey: ["/api/admin/b2b-applications"],
  });

  const action = useMutation({
    mutationFn: async ({
      id,
      type,
    }: {
      id: number;
      type: "approve" | "reject" | "resend-password";
    }) => {
      const response = await apiRequest(
        "POST",
        `/api/admin/b2b-applications/${id}/${type}`,
      );
      return response.json().catch(() => ({}));
    },
    onSuccess: async (result: any, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["/api/admin/b2b-applications"],
      });

      if (
        variables.type === "approve" &&
        result?.emailSent === false &&
        result?.temporaryPassword
      ) {
        const application = data.find((item) => item.id === variables.id);
        setFallbackCredential({
          email: application?.email || application?.username || "",
          password: String(result.temporaryPassword),
          error: result?.emailError || null,
        });
      }

      toast({
        title:
          variables.type === "approve"
            ? "Başvuru onaylandı"
            : variables.type === "reject"
              ? "Başvuru reddedildi"
              : "Şifre yeniden gönderildi",
        description:
          result?.message ||
          (variables.type === "approve"
            ? "Tek kullanımlık şifre kullanıcı için oluşturuldu."
            : undefined),
      });
    },
    onError: (error: Error) => {
      toast({
        title: "İşlem tamamlanamadı",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const pending = data.filter((item) => item.applicationStatus === "pending");
  const approved = data.filter((item) => item.applicationStatus === "approved");
  const rejected = data.filter((item) => item.applicationStatus === "rejected");

  return (
    <div className="h-full overflow-y-auto bg-muted/20">
      <div className="mx-auto max-w-7xl p-5 sm:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black tracking-tight">Başvurular</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            B2B firma üyelik başvurularını inceleyin, onaylayın ve giriş bilgilerini yönetin.
          </p>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Summary
            icon={<Clock3 className="h-5 w-5" />}
            label="Bekleyen"
            value={pending.length}
          />
          <Summary
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Onaylanan"
            value={approved.length}
          />
          <Summary
            icon={<XCircle className="h-5 w-5" />}
            label="Reddedilen"
            value={rejected.length}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
          {isLoading ? (
            <div className="p-8 text-sm text-muted-foreground">
              Başvurular yükleniyor…
            </div>
          ) : data.length === 0 ? (
            <div className="p-10 text-center">
              <Building2 className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <div className="mt-3 font-semibold">Henüz firma başvurusu yok</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Web sitesinden gönderilen B2B başvuruları burada listelenecek.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {data.map((item) => {
                const status = item.applicationStatus || "pending";
                const fullName = [item.firstName, item.lastName]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <div key={item.id} className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-base font-bold">
                            {item.companyName || "Firma"}
                          </div>
                          <StatusBadge status={status} />
                          {item.taxVerified ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Vergi doğrulandı
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2 grid gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                          <span>{fullName || "—"}</span>
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{item.email || item.username}</span>
                          </span>
                          <span>{item.companyCategory || "Kategori yok"}</span>
                          <span>
                            {item.taxNumber || "VKN yok"}
                            {item.taxOffice ? ` · ${item.taxOffice}` : ""}
                          </span>
                        </div>

                        <div className="mt-2 text-xs text-muted-foreground">
                          Başvuru: {formatDate(item.createdAt)}
                          {item.credentialsSentAt
                            ? ` · Son şifre gönderimi: ${formatDate(item.credentialsSentAt)}`
                            : ""}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 xl:justify-end">
                        {status === "pending" ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() =>
                                action.mutate({ id: item.id, type: "approve" })
                              }
                              disabled={action.isPending}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Onayla
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                action.mutate({ id: item.id, type: "reject" })
                              }
                              disabled={action.isPending}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Reddet
                            </Button>
                          </>
                        ) : null}

                        {status === "approved" && item.mustChangePassword ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              action.mutate({
                                id: item.id,
                                type: "resend-password",
                              })
                            }
                            disabled={action.isPending}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Tek Kullanımlık Şifreyi Yenile
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(fallbackCredential)}
        onOpenChange={(open) => {
          if (!open) setFallbackCredential(null);
        }}
      >
        <DialogContent className="inset-auto left-1/2 top-1/2 h-auto min-h-0 max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle>Başvuru onaylandı</DialogTitle>
            <DialogDescription>
              Hesap aktif edildi. E-posta servisi henüz bağlı olmadığı için tek kullanımlık şifre otomatik gönderilemedi.
            </DialogDescription>
          </DialogHeader>

          {fallbackCredential ? (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="text-xs font-medium text-muted-foreground">Kullanıcı</div>
                <div className="mt-1 break-all text-sm font-semibold">
                  {fallbackCredential.email}
                </div>

                <div className="mt-4 text-xs font-medium text-muted-foreground">
                  Tek kullanımlık şifre
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-base font-bold tracking-wider">
                    {fallbackCredential.password}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={async () => {
                      await navigator.clipboard.writeText(fallbackCredential.password);
                      toast({
                        title: "Şifre kopyalandı",
                        description: "Tek kullanımlık şifre panoya kopyalandı.",
                      });
                    }}
                    aria-label="Şifreyi kopyala"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                Bu şifre yalnızca ilk giriş için geçerlidir. Kullanıcı giriş yaptıktan sonra yeni şifre oluşturmak zorundadır.
              </div>

              <Button
                type="button"
                className="w-full"
                onClick={() => setFallbackCredential(null)}
              >
                Tamam
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Summary({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border bg-background p-4 shadow-sm">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-sm">{label}</span>
        {icon}
      </div>
      <div className="mt-3 text-2xl font-black">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
        Onaylandı
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
        Reddedildi
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
      Onay Bekliyor
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
