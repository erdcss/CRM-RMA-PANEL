import { useEffect, useState, type ReactNode } from "react";
import {
  Image,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { GlassTabBar } from "./components/GlassTabBar";
import { signOut, type BusinessAuthUser } from "./lib/auth";
import { useMobileBranding } from "./lib/branding";
import { listenBusinessNotificationPress, registerBusinessPush, unregisterBusinessPush } from "./lib/push";

import { CustomersScreen } from "./screens/CustomersScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { LowStockScreen } from "./screens/LowStockScreen";
import { MarketplaceScreen } from "./screens/MarketplaceScreen";
import { ModuleScreen } from "./screens/ModuleScreen";
import { BusinessApplicationsScreen } from "./screens/BusinessApplicationsScreen";
import { BusinessCustomerCenterScreen } from "./screens/BusinessCustomerCenterScreen";
import { MoreScreen } from "./screens/MoreScreen";
import { OrderDetailScreen } from "./screens/OrderDetailScreen";
import { SupplierOrderDetailScreen } from "./screens/SupplierOrderDetailScreen";
import { OrdersScreen } from "./screens/OrdersScreen";
import { ProductAddScreen } from "./screens/ProductAddScreen";
import { AiProductStudioScreen } from "./screens/AiProductStudioScreen";
import { ProductsScreen } from "./screens/ProductsScreen";
import { SupportScreen } from "./screens/SupportScreen";
import type { MainTab, Screen } from "./types";
import { C } from "./ui/theme";

export default function App() {
  const branding = useMobileBranding();
  const [screen, setScreen] = useState<Screen>({ name: "login" });
  const [user, setUser] = useState<BusinessAuthUser | null>(null);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Load the current admin-managed splash at each startup, with an offline deadline.
    const timer = setTimeout(() => setShowSplash(false), branding.loaded ? 1400 : 3500);
    return () => clearTimeout(timer);
  }, [branding.loaded]);

  useEffect(() => {
    if (!user || user.role === "business_reviewer") return;
    void registerBusinessPush().catch((error) => {
      console.warn("Business push registration failed:", error);
    });
  }, [user]);

  useEffect(() => {
    const subscription = listenBusinessNotificationPress((type, data) => {
      if (type === "order" && user?.role === "super_admin") {
        const orderId = typeof data.orderId === "string" ? data.orderId : "";
        if (orderId) setScreen({ name: "orderDetail", id: orderId });
        else setScreen({ name: "orders" });
      }
      if (type === "support" && user?.role === "super_admin") setScreen({ name: "support" });
      if (["supplier_order_paid","supplier_paused","supplier_resumed"].includes(type) && user?.role === "b2b_seller") setScreen({name:"marketplace"});
    });
    return () => subscription.remove();
  }, [user?.role]);

  const openModule = (slug: string, origin: "dashboard" | "more" = "dashboard") => {
    if (slug === "stok-durumu") setScreen({ name: "lowStock", backTo: origin });
    else if (slug === "basvurular") setScreen({ name: "applications" });
    else if (slug === "b2b-musteriler") setScreen({ name: "customers" });
    else setScreen({ name: "module", slug });
  };

  const openTab = (tab: MainTab) => {
    if (tab === "dashboard") setScreen({ name: "dashboard" });
    if (tab === "orders") setScreen({ name: "orders" });
    if (tab === "products") setScreen({ name: "products" });
    if (tab === "customers") setScreen({ name: "customers" });
    if (tab === "more") setScreen({ name: "more" });
  };

  return (
    <SafeAreaProvider>
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />

        {screen.name === "login" ? (
          <LoginScreen
            background={branding.business_mobile_splash}
            onSuccess={(nextUser) => {
              setUser(nextUser);
              setScreen(nextUser.role === "b2b_seller" ? { name: "marketplace" } : { name: "dashboard" });
            }}
          />
        ) : screen.name === "marketplace" ? (
          <SafeAreaView style={s.fullSafe} edges={["top", "left", "right", "bottom"]}>
            <MarketplaceScreen
              isSuper={user?.role === "super_admin" || user?.role === "admin"}
              initialTab={screen.tab}
              onAiProductAdd={() => setScreen({ name: "aiProductStudio", mode: user?.role === "super_admin" ? "super_admin" : "supplier" })}
              onOpenOrder={(id)=>{if(user?.role==="super_admin"||user?.role==="admin")setScreen({name:"orderDetail",id});}}
              onOpenSupplierOrder={(id)=>{if(user?.role==="b2b_seller")setScreen({name:"supplierOrderDetail",id});}}
              onBack={() => setScreen({ name: "more" })}
              onLogout={async () => {
                await unregisterBusinessPush();
                await signOut();
                setUser(null);
                setScreen({ name: "login" });
              }}
            />
          </SafeAreaView>
        ) : screen.name === "supplierOrderDetail" ? (
          <SafeAreaView style={s.fullSafe} edges={["top","left","right","bottom"]}>
            {user?.role==="b2b_seller" ? (
              <SupplierOrderDetailScreen
                id={screen.id}
                onBack={()=>setScreen({name:"marketplace",tab:"orders"})}
              />
            ) : null}
          </SafeAreaView>
        ) : screen.name === "dashboard" ? (
          <AdminShell reviewer={user?.role === "business_reviewer"} active="dashboard" onTab={openTab}>
            <DashboardScreen
              user={user}
              onOrders={() => setScreen({ name: "orders" })}
              onOpenOrder={(id)=>setScreen({name:"orderDetail",id})}
              onSupport={() => setScreen({ name: "support" })}
              onProducts={() => setScreen({ name: "products" })}
              onCustomers={() => setScreen({ name: "customers" })}
              onModule={(slug) => openModule(slug, "dashboard")}
            />
          </AdminShell>
        ) : screen.name === "orders" ? (
          <AdminShell reviewer={user?.role === "business_reviewer"} active="orders" onTab={openTab}>
            <OrdersScreen
              onOpenOrder={(id) => setScreen({ name: "orderDetail", id })}
            />
          </AdminShell>
        ) : screen.name === "orderDetail" ? (
          <SafeAreaView style={s.fullSafe} edges={["top", "left", "right", "bottom"]}>
            <OrderDetailScreen
              id={screen.id}
              onBack={() => setScreen({ name: "orders" })}
            />
          </SafeAreaView>
        ) : screen.name === "products" ? (
          <AdminShell reviewer={user?.role === "business_reviewer"} active="products" onTab={openTab}>
            <ProductsScreen onAdd={() => setScreen({ name: "productAdd" })}
              onEdit={(id) => setScreen({ name: "productEdit", id, backTo: "products" })}
              onAiAdd={user?.role === "super_admin" ? () => setScreen({ name: "aiProductStudio", mode: "super_admin" }) : undefined} />
          </AdminShell>
        ) : screen.name === "lowStock" ? (
          <SafeAreaView style={s.fullSafe} edges={["top", "left", "right", "bottom"]}>
            <LowStockScreen
              onBack={() => setScreen(screen.backTo === "more" ? { name: "more" } : { name: "dashboard" })}
              onProducts={() => setScreen({ name: "products" })}
              onEdit={(id) => setScreen({ name: "productEdit", id, backTo: "lowStock", stockBackTo: screen.backTo })}
            />
          </SafeAreaView>
        ) : screen.name === "productEdit" ? (
          <SafeAreaView style={s.fullSafe} edges={["top", "left", "right", "bottom"]}>
            <ProductAddScreen
              productId={screen.id}
              onBack={() => setScreen(screen.backTo === "products" ? { name: "products" } : { name: "lowStock", backTo: screen.stockBackTo || "dashboard" })}
              onCreated={() => setScreen(screen.backTo === "products" ? { name: "products" } : { name: "lowStock", backTo: screen.stockBackTo || "dashboard" })}
            />
          </SafeAreaView>
        ) : screen.name === "productAdd" ? (
          <SafeAreaView style={s.fullSafe} edges={["top", "left", "right", "bottom"]}>
            <ProductAddScreen
              onBack={() => setScreen({ name: "products" })}
              onCreated={() => setScreen({ name: "products" })}
            />
          </SafeAreaView>
        ) : screen.name === "aiProductStudio" ? (
          <SafeAreaView style={s.fullSafe} edges={["top", "left", "right", "bottom"]}>
            <AiProductStudioScreen
              mode={screen.mode}
              onBack={() => setScreen(screen.mode === "supplier" ? { name: "marketplace", tab: "products" } : { name: "products" })}
              onCreated={() => setScreen(screen.mode === "supplier" ? { name: "marketplace", tab: "products" } : { name: "products" })}
            />
          </SafeAreaView>
        ) : screen.name === "customers" ? (
          <AdminShell reviewer={user?.role === "business_reviewer"} active="customers" onTab={openTab}>
            <CustomersScreen
              onOpenCustomer={(id) => setScreen({ name: "customerDetail", id })}
            />
          </AdminShell>
        ) : screen.name === "customerDetail" ? (
          <SafeAreaView style={s.fullSafe} edges={["top", "left", "right", "bottom"]}>
            <BusinessCustomerCenterScreen
              id={screen.id}
              mode="customer"
              onBack={() => setScreen({ name: "customers" })}
            />
          </SafeAreaView>
        ) : screen.name === "applications" ? (
          <SafeAreaView style={s.fullSafe} edges={["top", "left", "right", "bottom"]}>
            <BusinessApplicationsScreen
              onBack={() => setScreen({ name: "more" })}
              onOpenApplication={(id) => setScreen({ name: "applicationDetail", id })}
              onOpenCustomer={() => setScreen({ name: "customers" })}
            />
          </SafeAreaView>
        ) : screen.name === "applicationDetail" ? (
          <SafeAreaView style={s.fullSafe} edges={["top", "left", "right", "bottom"]}>
            <BusinessCustomerCenterScreen
              id={screen.id}
              mode="application"
              onBack={() => setScreen({ name: "applications" })}
              onOpenCustomer={(id) => setScreen({ name: "customerDetail", id })}
            />
          </SafeAreaView>
        ) : screen.name === "support" ? (
          <AdminShell reviewer={user?.role === "business_reviewer"} active="more" onTab={openTab}>
            <SupportScreen />
          </AdminShell>
        ) : screen.name === "more" ? (
          <AdminShell reviewer={user?.role === "business_reviewer"} active="more" onTab={openTab}>
            <MoreScreen
              user={user}
              onSupport={() => setScreen({ name: "support" })}
              onMarketplace={() => setScreen({ name: "marketplace" })}
              onModule={(slug) => openModule(slug, "more")}
              onLogout={async () => {
                await unregisterBusinessPush();
                await signOut();
                setUser(null);
                setScreen({ name: "login" });
              }}
            />
          </AdminShell>
        ) : screen.name === "module" ? (
          <SafeAreaView style={s.fullSafe} edges={["top", "left", "right", "bottom"]}>
            <ModuleScreen
              slug={screen.slug}
              onBack={() => setScreen({ name: "more" })}
            />
          </SafeAreaView>
        ) : null}

        {showSplash ? (
          <View style={s.splash} pointerEvents="none">
            {branding.business_mobile_splash || branding.business_mobile_logo ? (
              <Image
                source={{
                  uri:
                    branding.business_mobile_splash ||
                    branding.business_mobile_logo ||
                    "",
                }}
                style={s.splashImage}
                resizeMode="cover"
              />
            ) : (
              <Text style={s.splashText}>Çalışkan Business</Text>
            )}
          </View>
        ) : null}
      </View>
    </SafeAreaProvider>
  );
}

function AdminShell({
  active,
  onTab,
  children,
  reviewer = false,
}: {
  active: MainTab;
  onTab: (tab: MainTab) => void;
  children: ReactNode;
  reviewer?: boolean;
}) {
  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.shell}>
        {reviewer ? (
          <View style={s.reviewNotice}>
            <Text style={s.reviewNoticeText}>
              İnceleme hesabı · Temsilî veriler · Salt okunur
            </Text>
          </View>
        ) : null}
        {children}
        <GlassTabBar active={active} onTab={onTab} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1, backgroundColor: C.bg },
  fullSafe: { flex: 1, backgroundColor: C.bg },
  shell: { flex: 1, backgroundColor: C.bg },
  reviewNotice: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.panel, borderBottomColor: C.line, borderBottomWidth: 1 },
  reviewNoticeText: { fontSize: 11, fontWeight: "600", color: C.text2, textAlign: "center" },
  splash: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  splashImage: {
    width: "100%",
    height: "100%",
  },
  splashText: {
    color: C.text,
    fontSize: 28,
    fontWeight: "600",
  },
});
