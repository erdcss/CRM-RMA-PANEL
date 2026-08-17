import { Link } from "wouter";
import { Package, User, Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export interface TicketListProduct {
  id: number;
  name: string;
  brand: string;
  model?: string;
  serialNumber?: string;
  category: string;
  status: string;
  description?: string;
  imageUrl?: string;
}

export interface TicketListItem {
  id: number;
  receiptNumber?: string;
  createdAt: string;
  customer: {
    id: number;
    name: string;
    phone: string;
    email?: string;
  };
  products: TicketListProduct[];
}

const categoryLabels: Record<string, string> = {
  iade: "İade",
  degisim: "Değişim",
  servis: "Servis",
};

const statusLabels: Record<string, string> = {
  beklemede: "Beklemede",
  serviste: "Serviste",
  teslim_edildi: "Teslim Edildi",
  iptal: "İptal",
};

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  beklemede: "secondary",
  serviste: "default",
  teslim_edildi: "outline",
  iptal: "destructive",
};

interface TicketListCardProps {
  ticket: TicketListItem;
  products: TicketListProduct[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TicketListCard({ ticket, products, open, onOpenChange }: TicketListCardProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card className="hover-elevate">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <CollapsibleTrigger className="flex-1 text-left min-w-0" data-testid={`button-toggle-ticket-${ticket.id}`}>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base sm:text-lg truncate">
                    {ticket.receiptNumber ? `Fiş ${ticket.receiptNumber}` : `Fiş #${ticket.id}`}
                  </CardTitle>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                </div>
                <CardDescription className="flex items-center gap-3 text-sm flex-wrap">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {ticket.customer.name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(ticket.createdAt), "d MMM yyyy", { locale: tr })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {products.length} Ürün
                  </span>
                </CardDescription>
              </div>
            </CollapsibleTrigger>
            <Button variant="outline" size="sm" asChild data-testid={`button-view-ticket-${ticket.id}`}>
              <Link href={`/kayit/${ticket.id}`}>
                Detay
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-card"
                  data-testid={`product-item-${product.id}`}
                >
                  {product.imageUrl && (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-14 w-14 rounded-md object-cover border shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{product.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {categoryLabels[product.category]}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">{product.brand}</span>
                      {product.model && ` - ${product.model}`}
                      {product.serialNumber && (
                        <span className="font-mono ml-2">#{product.serialNumber}</span>
                      )}
                    </div>
                    {product.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {product.description}
                      </p>
                    )}
                  </div>
                  <Badge variant={statusColors[product.status]} className="ml-1 shrink-0">
                    {statusLabels[product.status]}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
