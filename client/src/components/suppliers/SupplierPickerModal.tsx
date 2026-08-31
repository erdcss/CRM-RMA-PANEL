import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

type CatalogCustomer = {
  id: number;
  accountCode: string;
  accountName: string;
};

type Props = {
  open: boolean;
  title?: string;
  selectedAccountCode?: string;
  onClose: () => void;
  onSelect: (customer: CatalogCustomer) => void;
};

export function SupplierPickerModal({
  open,
  title = "Tedarikçi Seç",
  selectedAccountCode,
  onClose,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");

  const { data: customers = [] } = useQuery<CatalogCustomer[]>({
    queryKey: ["/api/catalog-customers"],
    enabled: open,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return customers;
    return customers.filter((row) =>
      `${row.accountCode} ${row.accountName}`.toLocaleLowerCase("tr-TR").includes(q),
    );
  }, [customers, query]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Cari kodu veya adı ara..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <ScrollArea className="max-h-80">
          <div className="space-y-1 pr-3">
            {filtered.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => onSelect(row)}
                className={`w-full text-left rounded-md border px-3 py-2 hover:bg-muted ${
                  selectedAccountCode === row.accountCode ? "border-primary bg-primary/5" : ""
                }`}
              >
                <p className="font-medium">{row.accountName}</p>
                <p className="text-xs text-muted-foreground font-mono">{row.accountCode}</p>
              </button>
            ))}
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Tedarikçi bulunamadı</p>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
