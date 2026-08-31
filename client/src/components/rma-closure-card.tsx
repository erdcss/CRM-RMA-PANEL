import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type ClosureCheck = { key: string; label: string; ok: boolean; detail?: string };

type ClosureStatus = {
  ticketId: number;
  rmaStatus: string;
  canClose: boolean;
  checks: ClosureCheck[];
  blockers: string[];
  closedAt?: string | null;
};

export function RmaClosureCard({ ticketId }: { ticketId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<ClosureStatus>({
    queryKey: [`/api/rma/tickets/${ticketId}/closure-status`],
    enabled: Boolean(ticketId),
  });

  const closeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/rma/tickets/${ticketId}/close`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/rma/tickets/${ticketId}/closure-status`] });
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/rma"] });
      toast({ title: "RMA kapatildi" });
    },
    onError: (e: Error) => toast({ title: "Kapatilamadi", description: e.message, variant: "destructive" }),
  });

  if (isLoading || !data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">RMA Kapanis Durumu</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {data.checks.map((c) => (
            <div key={c.key} className="flex items-start gap-2 text-sm">
              {c.ok ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              )}
              <span>{c.label}</span>
            </div>
          ))}
        </div>

        {data.rmaStatus === "closed" ? (
          <p className="text-sm text-muted-foreground">
            RMA kapatildi
            {data.closedAt ? ` · ${new Date(data.closedAt).toLocaleString("tr-TR")}` : ""}
          </p>
        ) : data.canClose ? (
          <Button onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>
            RMA Kapat
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">RMA su anda kapatilamaz.</p>
        )}
      </CardContent>
    </Card>
  );
}
