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
import { listenBusinessNotificationPress, registerBusinessPush } from "./lib/push";
import { CustomerDetailScreen } from "./screens/CustomerDetailScreen";
import { CustomersScreen } from "./screens/CustomersScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { MarketplaceScreen } from "./screens/MarketplaceScreen";
import { ModuleScreen } from "./screens/ModuleScreen";
import { MoreScreen } from "./screens/MoreScreen";
import { OrderDetailScreen } from "./screens/OrderDetailScreen";
import { OrdersScreen } from "./screens/OrdersScreen";
import { ProductAddScreen } from "./screens/ProductAddScreen";
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
    const timer = setTimeout(() => setShowSplash(false), 900);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
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
              setScreen({ name: nextUser.role === "b2b_seller" || nextUser.role === "b2b_customer" ? "marketplace" : "dashboard" });
            }}
          />
        ) : screen.name === "marketplace" ? (
          <SafeAreaView style={s.fullSafe} edges={["top", "left", "right", "bottom"]}>
            <MarketplaceScreen
              isSuper={user?.role === "super_admin"}
              onBack={() => setScreen({ name: "more" })}
              onLogout={async () => {
                await signOut();
                setUser(null);
                setScreen({ name: "login" });
              }}
            />
          </SafeAreaView>
        ) : screen.name === "dashboard" ? (
          <AdminShell active="dashboard" onTab={openTab}>
            <DashboardScreen
              user={user}
              onOrders={() => setScreen({ name: "orders" })}
              onSupport={() => setScreen({ name: "support" })}
              onProducts={() => setScreen({ name: "products" })}
              onCustomers={() => setScreen({ name: "customers" })}
              onModule={(slug) => setScreen({ name: "module", slug })}
            />
          </AdminShell>
        ) : screen.name === "orders" ? (
          <AdminShell active="orders" onTab={openTab}>
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
          <AdminShell active="products" onTab={openTab}>
            <ProductsScreen onAdd={() => setScreen({ name: "productAdd" })} />
          </AdminShell>
        ) : screen.name === "productAdd" ? (
          <SafeAreaView style={s.fullSafe} edges={["top", "left", "right", "bottom"]}>
            <ProductAddScreen
              onBack={() => setScreen({ name: "products" })}
              onCreated={() => setScreen({ name: "products" })}
            />
          </SafeAreaView>
        ) : screen.name === "customers" ? (
          <AdminShell active="customers" onTab={openTab}>
            <CustomersScreen
              onOpenCustomer={(id) => setScreen({ name: "customerDetail", id })}
            />
          </AdminShell>
        ) : screen.name === "customerDetail" ? (
          <SafeAreaView style={s.fullSafe} edges={["top", "left", "right", "bottom"]}>
            <CustomerDetailScreen
              id={screen.id}
              onBack={() => setScreen({ name: "customers" })}
            />
          </SafeAreaView>
        ) : screen.name === "support" ? (
          <AdminShell active="more" onTab={openTab}>
            <SupportScreen />
          </AdminShell>
        ) : screen.name === "more" ? (
          <AdminShell active="more" onTab={openTab}>
            <MoreScreen
              user={user}
              onSupport={() => setScreen({ name: "support" })}
              onMarketplace={() => setScreen({ name: "marketplace" })}
              onModule={(slug) => setScreen({ name: "module", slug })}
              onLogout={async () => {
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
}: {
  active: MainTab;
  onTab: (tab: MainTab) => void;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.shell}>
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
  splash: {
    ...StyleSheet.absoluteFillObject,
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
