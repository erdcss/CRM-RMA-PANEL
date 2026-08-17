import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Users,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { BRAND } from "@/lib/brand";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Kayıtlar",
    url: "/kayitlar",
    icon: FileText,
  },
  {
    title: "İstatistikler",
    url: "/istatistikler",
    icon: BarChart3,
  },
  {
    title: "Müşteriler",
    url: "/musteriler",
    icon: Users,
  },
  {
    title: "Ayarlar",
    url: "/ayarlar",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-2.5 px-1">
          <img
            src={BRAND.logo}
            alt={BRAND.name}
            width={36}
            height={36}
            className="h-9 w-9 rounded-md object-cover border border-sidebar-border shrink-0"
          />
          <div className="min-w-0">
            <p className="text-base font-bold tracking-tight leading-tight truncate">
              {BRAND.name}
            </p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
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
      <SidebarFooter className="p-4">
        <div className="flex items-center justify-center">
          <span className="text-sm text-muted-foreground">{BRAND.name} v{BRAND.version}</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
