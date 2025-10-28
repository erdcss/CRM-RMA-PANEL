import { useQuery } from "@tanstack/react-query";
import { User, Mail, Phone, MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  ticketCount?: number;
  createdAt: string;
}

export default function Musteriler() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const filteredCustomers = (customers || []).filter((customer) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      customer.name.toLowerCase().includes(query) ||
      customer.phone.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Müşteriler</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tüm müşteri kayıtları
            </p>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {customers?.length || 0} Müşteri
          </Badge>
        </div>
      </div>

      <div className="p-6 border-b">
        <Input
          placeholder="Müşteri ara (isim, telefon, e-posta)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
          data-testid="input-search-customers"
        />
      </div>

      <main className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <User className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? "Müşteri bulunamadı" : "Henüz müşteri kaydı yok"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCustomers.map((customer) => (
              <Card key={customer.id} className="hover-elevate">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg" data-testid={`text-customer-name-${customer.id}`}>
                          {customer.name}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {new Date(customer.createdAt).toLocaleDateString("tr-TR")}
                        </CardDescription>
                      </div>
                    </div>
                    {customer.ticketCount !== undefined && customer.ticketCount > 0 && (
                      <Badge variant="secondary">
                        {customer.ticketCount} kayıt
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-mono">{customer.phone}</span>
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{customer.email}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground line-clamp-2">
                        {customer.address}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
