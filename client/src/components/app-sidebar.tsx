import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Users,
  Settings,
  Package,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";

import { useAuth } from "@/contexts/AuthContext";

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Kayıtlar", url: "/kayitlar", icon: FileText },
  { title: "Ürünler", url: "/urunler", icon: Package },
  { title: "İstatistikler", url: "/istatistikler", icon: BarChart3 },
  { title: "Müşteriler", url: "/musteriler", icon: Users },
  { title: "Ayarlar", url: "/ayarlar", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { signOut } = useAuth();

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-bold flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-8 w-8 object-contain" />
            Çalışkan RMA
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} data-testid={`link-${item.title.toLowerCase()}`}>
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-2">
        <button
          type="button"
          onClick={() => signOut()}
          className="flex w-full items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Çıkış Yap
        </button>
        <div className="flex items-center justify-center">
          <span className="text-xs text-muted-foreground">Çalışkan RMA v1.0</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
