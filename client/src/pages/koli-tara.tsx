import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

export default function KoliTara() {
  const [, navigate] = useLocation();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const lookupQuery = useQuery({
    queryKey: ["/api/rma/packages/lookup", value],
    enabled: false,
  });

  const handleScan = async (raw?: string) => {
    const q = (raw ?? value).trim();
    if (!q) return;
    setValue(q);
    try {
      const res = await apiRequest("GET", `/api/rma/packages/lookup?q=${encodeURIComponent(q)}`);
      const pkg = await res.json();
      navigate(`/koliler/${pkg.id}`);
    } catch {
      inputRef.current?.select();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 sm:p-6 border-b flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate("/koliler")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Geri
        </Button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ScanLine className="h-5 w-5" />Barkod / Koli Tara
        </h1>
      </div>

      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle className="text-base">USB barkod okuyucu veya manuel giris</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              ref={inputRef}
              autoFocus
              placeholder="Barkod, QR veya koli numarasi..."
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleScan();
                }
              }}
              className="font-mono"
            />
            <Button className="w-full" onClick={() => handleScan()} disabled={lookupQuery.isFetching}>
              Koli Ac
            </Button>
            <p className="text-xs text-muted-foreground">
              USB barkod okuyucu klavye gibi calisir — okutunca Enter ile otomatik acilir.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
