import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { signIn, signOut, type BusinessAuthUser } from "./lib/auth";
import { apiFetch } from "./lib/api";
import { ADMIN_MODULE_GROUPS, getAdminModule } from "./lib/admin-modules";
import { useMobileBranding } from "./lib/branding";

type Screen =
  | { name: "login" }
  | { name: "dashboard" }
  | { name: "orders" }
  | { name: "support" }
  | { name: "settings" }
  | { name: "menu" }
  | { name: "module"; slug: string };

type DashboardOverview = {
  sessionUsers: number;
  liveUsers: number;
  conversionRate: number;
  orderCount: number;
  activeReturns: number;
  recentOrders?: AdminOrder[];
  recentReturns?: Array<{
    id: string | number;
    name?: string | null;
    brand?: string | null;
    customer_name?: string | null;
    status?: string | null;
  }>;
};

type AdminOrder = {
  id: string | number;
  order_number?: string | null;
  customer_email?: string | null;
  customer_name?: string | null;
  status?: string | null;
  total_amount?: string | number | null;
  payment_status?: string | null;
  created_at?: string | null;
};

type SupportItem = {
  id: string | number;
  title?: string | null;
  subject?: string | null;
  code?: string | null;
  customer_name?: string | null;
  customerName?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type MainTab = "dashboard" | "orders" | "support" | "settings";

export default function App() {
  const branding = useMobileBranding();
  const [screen, setScreen] = useState<Screen>({ name: "login" });
  const [user, setUser] = useState<BusinessAuthUser | null>(null);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 900);
    return () => clearTimeout(timer);
  }, []);

  const openMainTab = (tab: MainTab) => setScreen({ name: tab });

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar
          barStyle={screen.name === "login" ? "light-content" : "dark-content"}
          backgroundColor={screen.name === "login" ? "#0B0B0B" : "#F5F6F8"}
        />

        {screen.name === "login" ? (
          <LoginScreen
            logo={branding.business_mobile_logo}
            onSuccess={(nextUser) => {
              setUser(nextUser);
              setScreen({ name: "dashboard" });
            }}
          />
        ) : screen.name === "dashboard" ? (
          <AdminShell active="dashboard" onTab={openMainTab}>
            <DashboardScreen
              user={user}
              onModule={(slug) => setScreen({ name: "module", slug })}
            />
          </AdminShell>
        ) : screen.name === "orders" ? (
          <AdminShell active="orders" onTab={openMainTab}>
            <OrdersScreen />
          </AdminShell>
        ) : screen.name === "support" ? (
          <AdminShell active="support" onTab={openMainTab}>
            <SupportScreen />
          </AdminShell>
        ) : screen.name === "settings" ? (
          <AdminShell active="settings" onTab={openMainTab}>
            <SettingsScreen
              user={user}
              onAllModules={() => setScreen({ name: "menu" })}
              onModule={(slug) => setScreen({ name: "module", slug })}
              onLogout={async () => {
                await signOut();
                setUser(null);
                setScreen({ name: "login" });
              }}
            />
          </AdminShell>
        ) : screen.name === "menu" ? (
          <MenuScreen
            onBack={() => setScreen({ name: "settings" })}
            onDashboard={() => setScreen({ name: "dashboard" })}
            onModule={(slug) => setScreen({ name: "module", slug })}
          />
        ) : (
          <ModuleScreen
            slug={screen.slug}
            onBack={() => setScreen({ name: "settings" })}
          />
        )}

        {showSplash ? (
          <View style={styles.splash} pointerEvents="none">
            {branding.business_mobile_splash || branding.business_mobile_logo ? (
              <Image
                source={{
                  uri:
                    branding.business_mobile_splash ||
                    branding.business_mobile_logo ||
                    "",
                }}
                style={styles.splashImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.splashText}>Çalışkan Business</Text>
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
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.adminSafeArea} edges={["top", "left", "right"]}>
      <View style={styles.adminShell}>
        {children}
        <GlassTabBar active={active} onTab={onTab} />
      </View>
    </SafeAreaView>
  );
}

function LoginScreen({
  logo,
  onSuccess,
}: {
  logo?: string | null;
  onSuccess: (user: BusinessAuthUser) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async () => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !password) {
      setMessage("E-posta ve şifrenizi eksiksiz girin.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const session = await signIn(normalized, password);
      onSuccess(session.user);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Giriş başarısız");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.loginScreen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.loginContent}
          keyboardShouldPersistTaps="handled"
        >
          {logo ? (
            <Image source={{ uri: logo }} style={styles.loginLogo} resizeMode="contain" />
          ) : null}
          <Text style={styles.loginTitle}>Çalışkan Business</Text>

          <TextInput
            style={styles.input}
            placeholder="E-posta"
            placeholderTextColor="#737373"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="email"
            returnKeyType="next"
          />

          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Şifre"
              placeholderTextColor="#737373"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
            />
            <TouchableOpacity
              style={styles.showButton}
              onPress={() => setShowPassword((value) => !value)}
            >
              <Text style={styles.showButtonText}>
                {showPassword ? "Gizle" : "Göster"}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void submit()}
          >
            <Text style={styles.loginButtonText}>
              {busy ? "Giriş yapılıyor…" : "Giriş Yap"}
            </Text>
          </TouchableOpacity>

          {message ? <Text style={styles.loginError}>{message}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DashboardScreen({
  user,
  onModule,
}: {
  user: BusinessAuthUser | null;
  onModule: (slug: string) => void;
}) {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await apiFetch<DashboardOverview>("/api/admin/dashboard-overview"));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Dashboard verileri alınamadı");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.dashboardContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
    >
      <View style={styles.topIdentity}>
        <Text style={styles.brand}>Çalışkan Business</Text>
        <Text style={styles.userEmail} numberOfLines={1}>
          {user?.email || user?.username || "Yönetici"}
        </Text>
      </View>

      <View style={styles.heroBlock}>
        <Text style={styles.kicker}>Canlı operasyon</Text>
        <Text style={styles.dashboardTitle}>Yönetim Dashboard</Text>
        <Text style={styles.dashboardSubtitle}>
          Admin web paneli ile aynı verileri mobilde anlık takip edin.
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color="#2563EB" style={styles.loader} />
      ) : (
        <>
          <View style={styles.metrics}>
            <Metric title="Oturum kullanıcısı" value={data?.sessionUsers ?? 0} />
            <Metric title="Canlı kullanıcı" value={data?.liveUsers ?? 0} />
            <Metric
              title="Dönüşüm oranı"
              value={`%${Number(data?.conversionRate ?? 0).toLocaleString("tr-TR", {
                maximumFractionDigits: 1,
              })}`}
            />
            <Metric title="Bugünkü sipariş" value={data?.orderCount ?? 0} />
            <Metric title="Aktif iade" value={data?.activeReturns ?? 0} />
          </View>

          <SectionTitle title="Hızlı işlemler" />
          <View style={styles.quickGrid}>
            {[
              ["Ürünler", "urunler"],
              ["Stok durumu", "stok-durumu"],
              ["İade işlemleri", "iade-islemleri"],
              ["Başvurular", "basvurular"],
              ["RMA kayıtları", "kayitlar"],
              ["Müşteriler", "musteriler"],
            ].map(([title, slug]) => (
              <TouchableOpacity
                key={slug}
                style={styles.quickCard}
                onPress={() => onModule(slug)}
                activeOpacity={0.72}
              >
                <Text style={styles.quickTitle}>{title}</Text>
                <Text style={styles.quickArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>

          <SectionTitle title="Son siparişler" />
          <View style={styles.panel}>
            {(data?.recentOrders || []).length === 0 ? (
              <Text style={styles.emptyText}>Henüz sipariş kaydı yok.</Text>
            ) : (
              data?.recentOrders?.slice(0, 5).map((order) => (
                <OrderRow key={String(order.id)} order={order} />
              ))
            )}
          </View>

          <SectionTitle title="Son iadeler" />
          <View style={styles.panel}>
            {(data?.recentReturns || []).length === 0 ? (
              <Text style={styles.emptyText}>Henüz iade kaydı yok.</Text>
            ) : (
              data?.recentReturns?.slice(0, 4).map((item) => (
                <View key={String(item.id)} style={styles.listRow}>
                  <View style={styles.listMain}>
                    <Text style={styles.listTitle}>
                      {item.name || item.brand || `İade #${item.id}`}
                    </Text>
                    <Text style={styles.smallMuted}>{item.customer_name || "—"}</Text>
                  </View>
                  <Text style={styles.statusText}>{item.status || "Bekliyor"}</Text>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function OrdersScreen() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await apiFetch<AdminOrder[]>("/api/admin/orders");
      setOrders(Array.isArray(result) ? result : []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Siparişler alınamadı");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const waiting = orders.filter((order) =>
    ["pending", "paid_stock_review", "processing", "new"].includes(
      String(order.status || "").toLowerCase(),
    ),
  ).length;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.tabPageContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
    >
      <PageHeading
        eyebrow="Sipariş yönetimi"
        title="Siparişler"
        description="Web panelindeki siparişleri aynı veri kaynağından yönetin."
      />

      <View style={styles.summaryRow}>
        <SummaryCard title="Toplam" value={orders.length} />
        <SummaryCard title="İşlem bekleyen" value={waiting} />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color="#2563EB" style={styles.loader} />
      ) : (
        <View style={styles.stackGap}>
          {orders.length === 0 ? (
            <EmptyCard title="Sipariş bulunamadı" text="Henüz görüntülenecek sipariş yok." />
          ) : (
            orders.map((order) => (
              <View key={String(order.id)} style={styles.orderCard}>
                <View style={styles.orderCardTop}>
                  <View style={styles.listMain}>
                    <Text style={styles.orderNumber}>
                      {order.order_number || `#${order.id}`}
                    </Text>
                    <Text style={styles.orderCustomer}>
                      {order.customer_name || order.customer_email || "Müşteri bilgisi yok"}
                    </Text>
                  </View>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>{order.status || "Bekliyor"}</Text>
                  </View>
                </View>
                <View style={styles.orderCardBottom}>
                  <Text style={styles.orderMeta}>
                    {order.payment_status ? `Ödeme: ${order.payment_status}` : "Ödeme bilgisi yok"}
                  </Text>
                  <Text style={styles.orderAmount}>
                    {Number(order.total_amount || 0).toLocaleString("tr-TR")} ₺
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

function SupportScreen() {
  const [items, setItems] = useState<SupportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await apiFetch<SupportItem[]>("/api/tickets");
      setItems(Array.isArray(result) ? result : []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Destek kayıtları alınamadı");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCount = items.filter((item) =>
    ["open", "pending", "new", "active"].includes(String(item.status || "").toLowerCase()),
  ).length;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.tabPageContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
    >
      <PageHeading
        eyebrow="Destek merkezi"
        title="Destek"
        description="RMA ve destek kayıtlarını mobil uygulamadan takip edin."
      />

      <View style={styles.summaryRow}>
        <SummaryCard title="Toplam kayıt" value={items.length} />
        <SummaryCard title="Açık kayıt" value={openCount} />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color="#2563EB" style={styles.loader} />
      ) : (
        <View style={styles.stackGap}>
          {items.length === 0 ? (
            <EmptyCard title="Destek kaydı yok" text="Açık destek veya RMA kaydı bulunmuyor." />
          ) : (
            items.map((item) => (
              <View key={String(item.id)} style={styles.supportCard}>
                <View style={styles.supportDot} />
                <View style={styles.listMain}>
                  <Text style={styles.supportTitle}>
                    {item.subject || item.title || item.code || `Kayıt #${item.id}`}
                  </Text>
                  <Text style={styles.supportSubtitle}>
                    {item.customer_name || item.customerName || "Müşteri bilgisi yok"}
                  </Text>
                </View>
                <Text style={styles.statusText}>{item.status || "Açık"}</Text>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

function SettingsScreen({
  user,
  onAllModules,
  onModule,
  onLogout,
}: {
  user: BusinessAuthUser | null;
  onAllModules: () => void;
  onModule: (slug: string) => void;
  onLogout: () => void | Promise<void>;
}) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.tabPageContent}>
      <PageHeading
        eyebrow="Uygulama"
        title="Ayarlar"
        description="Hesap, yönetim modülleri ve uygulama seçenekleri."
      />

      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>
            {(user?.email || user?.username || "Y").slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={styles.listMain}>
          <Text style={styles.profileName}>Yönetici hesabı</Text>
          <Text style={styles.profileEmail}>{user?.email || user?.username || "—"}</Text>
        </View>
      </View>

      <SectionTitle title="Yönetim" />
      <View style={styles.settingsPanel}>
        <SettingsRow title="Tüm modüller" subtitle="Admin web panelindeki tüm bölümler" onPress={onAllModules} />
        <SettingsRow title="Marka ayarları" subtitle="Logo, splash ve görünüm seçenekleri" onPress={() => onModule("ayarlar")} />
        <SettingsRow title="Yöneticiler" subtitle="Kullanıcı ve yetki yönetimi" onPress={() => onModule("yoneticiler")} />
      </View>

      <SectionTitle title="Oturum" />
      <TouchableOpacity style={styles.logoutCard} onPress={() => void onLogout()}>
        <Text style={styles.logoutCardText}>Çıkış yap</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function GlassTabBar({
  active,
  onTab,
}: {
  active: MainTab;
  onTab: (tab: MainTab) => void;
}) {
  const tabs: Array<{ key: MainTab; label: string; icon: string }> = [
    { key: "dashboard", label: "Ana Sayfa", icon: "⌂" },
    { key: "orders", label: "Siparişler", icon: "≡" },
    { key: "support", label: "Destek", icon: "?" },
    { key: "settings", label: "Ayarlar", icon: "⚙" },
  ];

  return (
    <View style={styles.tabBarWrap} pointerEvents="box-none">
      <View style={styles.glassTabBar}>
        {tabs.map((tab) => {
          const selected = active === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButton, selected && styles.tabButtonActive]}
              onPress={() => onTab(tab.key)}
              activeOpacity={0.78}
            >
              <View style={[styles.tabIconWrap, selected && styles.tabIconWrapActive]}>
                <Text style={[styles.tabIcon, selected && styles.tabIconActive]}>{tab.icon}</Text>
              </View>
              <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function MenuScreen({
  onBack,
  onDashboard,
  onModule,
}: {
  onBack: () => void;
  onDashboard: () => void;
  onModule: (slug: string) => void;
}) {
  return (
    <SafeAreaView style={styles.fullPageSafe}>
      <View style={styles.adminScreen}>
        <Header title="Tüm modüller" subtitle="Çalışkan Admin mobil yönetim menüsü" onBack={onBack} />
        <ScrollView contentContainerStyle={styles.menuContent}>
          {ADMIN_MODULE_GROUPS.map((group) => (
            <View key={group.title} style={styles.menuGroup}>
              <Text style={styles.menuGroupTitle}>{group.title}</Text>
              {group.items.map((item) => (
                <TouchableOpacity
                  key={item.slug}
                  style={styles.menuRow}
                  onPress={() =>
                    item.slug === "dashboard" ? onDashboard() : onModule(item.slug)
                  }
                >
                  <View style={styles.listMain}>
                    <Text style={styles.menuRowTitle}>{item.title}</Text>
                    <Text style={styles.menuRowDescription}>{item.description}</Text>
                  </View>
                  <Text style={styles.menuChevron}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function ModuleScreen({ slug, onBack }: { slug: string; onBack: () => void }) {
  const module = useMemo(() => getAdminModule(slug), [slug]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(Boolean(module?.endpoint));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!module?.endpoint) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setError("");
    try {
      setData(await apiFetch<any>(module.endpoint));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Veri alınamadı");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [module?.endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!module) {
    return (
      <SafeAreaView style={styles.fullPageSafe}>
        <View style={styles.adminScreen}>
          <Header title="Modül bulunamadı" onBack={onBack} />
        </View>
      </SafeAreaView>
    );
  }

  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : [];

  const objectEntries =
    data && !Array.isArray(data) && typeof data === "object"
      ? Object.entries(data).filter(([, value]) => {
          const type = typeof value;
          return (
            value == null ||
            type === "string" ||
            type === "number" ||
            type === "boolean"
          );
        })
      : [];

  return (
    <SafeAreaView style={styles.fullPageSafe}>
      <View style={styles.adminScreen}>
        <Header title={module.title} subtitle={module.description} onBack={onBack} />
        <ScrollView
          contentContainerStyle={styles.moduleContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
        >
          {loading ? (
            <ActivityIndicator size="large" color="#2563EB" style={styles.loader} />
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {objectEntries.length > 0 ? (
            <View style={styles.panel}>
              {objectEntries.map(([key, value]) => (
                <View key={key} style={styles.settingRow}>
                  <Text style={styles.settingKey}>{key.replace(/_/g, " ")}</Text>
                  <Text style={styles.settingValue}>{compactValue(value)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {rows.map((item: any, index: number) => (
            <View key={String(item?.id ?? index)} style={styles.recordCard}>
              <Text style={styles.recordTitle}>{itemTitle(item, index)}</Text>
              {itemSubtitle(item) ? (
                <Text style={styles.recordSubtitle}>{compactValue(itemSubtitle(item))}</Text>
              ) : null}
              {item?.status !== undefined ? (
                <Text style={styles.recordMeta}>Durum: {compactValue(item.status)}</Text>
              ) : null}
            </View>
          ))}

          {!loading &&
          module.endpoint &&
          rows.length === 0 &&
          objectEntries.length === 0 &&
          !error ? (
            <EmptyCard title="Kayıt bulunamadı" text="Admin web ile aynı veri kaynağı kontrol edildi." />
          ) : null}

          {!module.endpoint ? (
            <EmptyCard title={module.title} text="Bu modülün mobil işlem ekranı hazırlanıyor." />
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.pageHeading}>
      <Text style={styles.pageEyebrow}>{eyebrow}</Text>
      <Text style={styles.pageTitle}>{title}</Text>
      <Text style={styles.pageDescription}>{description}</Text>
    </View>
  );
}

function Header({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>‹</Text>
      </TouchableOpacity>
      <View style={styles.headerText}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>{title}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function OrderRow({ order }: { order: AdminOrder }) {
  return (
    <View style={styles.listRow}>
      <View style={styles.listMain}>
        <Text style={styles.listTitle}>{order.order_number || `#${order.id}`}</Text>
        <Text style={styles.smallMuted}>{order.customer_email || order.customer_name || "—"}</Text>
      </View>
      <View style={styles.listSide}>
        <Text style={styles.amount}>
          {Number(order.total_amount || 0).toLocaleString("tr-TR")} ₺
        </Text>
        <Text style={styles.statusText}>{order.status || "Bekliyor"}</Text>
      </View>
    </View>
  );
}

function SettingsRow({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.settingsRow} onPress={onPress} activeOpacity={0.72}>
      <View style={styles.listMain}>
        <Text style={styles.settingsRowTitle}>{title}</Text>
        <Text style={styles.settingsRowSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.settingsChevron}>›</Text>
    </TouchableOpacity>
  );
}

function EmptyCard({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function compactValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") {
    return Array.isArray(value) ? `${value.length} kayıt` : "Detay";
  }
  return String(value);
}

function itemTitle(item: any, index: number) {
  return (
    item?.order_number ||
    item?.name ||
    item?.title ||
    item?.customer_name ||
    item?.company_name ||
    item?.email ||
    item?.username ||
    item?.barcode ||
    item?.code ||
    `Kayıt #${item?.id ?? index + 1}`
  );
}

function itemSubtitle(item: any) {
  return (
    item?.customer_email ||
    item?.brand ||
    item?.phone ||
    item?.city ||
    item?.sku ||
    item?.description ||
    ""
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F6F8" },
  flex: { flex: 1 },
  splash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B0B0B",
  },
  splashImage: { width: "82%", height: "82%" },
  splashText: { color: "#FFF", fontSize: 28, fontWeight: "600" },

  loginScreen: { flex: 1, backgroundColor: "#0B0B0B" },
  loginContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 36,
  },
  loginLogo: { width: 104, height: 104, alignSelf: "center", marginBottom: 18 },
  loginTitle: {
    color: "#FFF",
    fontSize: 28,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 28,
  },
  input: {
    minHeight: 54,
    backgroundColor: "#121212",
    borderWidth: 1,
    borderColor: "#303030",
    borderRadius: 13,
    paddingHorizontal: 15,
    color: "#FFF",
    fontSize: 16,
    marginBottom: 14,
    fontWeight: "400",
  },
  passwordRow: {
    minHeight: 54,
    backgroundColor: "#121212",
    borderWidth: 1,
    borderColor: "#303030",
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 14,
    color: "#FFF",
    fontSize: 16,
    fontWeight: "400",
  },
  showButton: { paddingHorizontal: 15, paddingVertical: 14 },
  showButtonText: { color: "#FFF", fontWeight: "500", fontSize: 13 },
  loginButton: {
    minHeight: 54,
    borderRadius: 13,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonText: { color: "#111", fontWeight: "600", fontSize: 16 },
  loginError: { color: "#FFB4B4", marginTop: 12, lineHeight: 20 },
  disabled: { opacity: 0.6 },

  adminSafeArea: { flex: 1, backgroundColor: "#F5F6F8" },
  fullPageSafe: { flex: 1, backgroundColor: "#F5F6F8" },
  adminShell: { flex: 1, backgroundColor: "#F5F6F8" },
  adminScreen: { flex: 1, backgroundColor: "#F5F6F8" },
  page: { flex: 1, backgroundColor: "#F5F6F8" },

  dashboardContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 126,
  },
  tabPageContent: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 126,
  },
  topIdentity: {
    marginBottom: 34,
  },
  brand: {
    fontSize: 21,
    fontWeight: "600",
    color: "#172033",
  },
  userEmail: {
    marginTop: 5,
    color: "#7A8497",
    fontSize: 13,
    fontWeight: "400",
  },
  heroBlock: {
    marginBottom: 24,
  },
  kicker: {
    fontSize: 13,
    fontWeight: "500",
    color: "#2563EB",
    marginBottom: 7,
  },
  dashboardTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "600",
    color: "#172033",
  },
  dashboardSubtitle: {
    marginTop: 9,
    color: "#778196",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400",
  },

  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: {
    width: "48%",
    minHeight: 116,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E8EE",
  },
  metricTitle: { color: "#778196", fontSize: 13, fontWeight: "400" },
  metricValue: {
    marginTop: 16,
    color: "#172033",
    fontSize: 30,
    fontWeight: "600",
  },

  sectionTitle: {
    marginTop: 28,
    marginBottom: 12,
    fontSize: 20,
    color: "#172033",
    fontWeight: "600",
  },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickCard: {
    width: "48%",
    minHeight: 72,
    paddingHorizontal: 15,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E8EE",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quickTitle: { color: "#172033", fontWeight: "500", fontSize: 14 },
  quickArrow: { color: "#2563EB", fontSize: 25, fontWeight: "400" },

  panel: {
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E8EE",
    backgroundColor: "#FFFFFF",
  },
  listRow: {
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E6E9EF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listMain: { flex: 1, paddingRight: 12 },
  listSide: { alignItems: "flex-end" },
  listTitle: { color: "#172033", fontWeight: "500", fontSize: 14 },
  amount: { color: "#172033", fontWeight: "600", fontSize: 13 },
  smallMuted: { color: "#8A93A4", fontSize: 12, marginTop: 4, fontWeight: "400" },
  statusText: { color: "#667085", fontSize: 12, marginTop: 4, fontWeight: "400" },

  pageHeading: { marginBottom: 24 },
  pageEyebrow: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 7,
  },
  pageTitle: {
    color: "#172033",
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "600",
  },
  pageDescription: {
    color: "#778196",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400",
    marginTop: 8,
  },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  summaryCard: {
    flex: 1,
    minHeight: 98,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E8EE",
    padding: 16,
  },
  summaryTitle: { color: "#778196", fontSize: 13, fontWeight: "400" },
  summaryValue: { color: "#172033", fontSize: 28, fontWeight: "600", marginTop: 10 },
  stackGap: { gap: 10 },

  orderCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E8EE",
    padding: 16,
  },
  orderCardTop: { flexDirection: "row", alignItems: "flex-start" },
  orderNumber: { color: "#172033", fontSize: 15, fontWeight: "600" },
  orderCustomer: { color: "#858FA1", fontSize: 12, marginTop: 5, fontWeight: "400" },
  orderCardBottom: {
    marginTop: 16,
    paddingTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E7EAF0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  orderMeta: { color: "#858FA1", fontSize: 12, fontWeight: "400" },
  orderAmount: { color: "#172033", fontSize: 15, fontWeight: "600" },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#EEF4FF",
  },
  statusPillText: { color: "#2563EB", fontSize: 11, fontWeight: "500" },

  supportCard: {
    minHeight: 78,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E8EE",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  supportDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#2563EB",
    marginRight: 12,
  },
  supportTitle: { color: "#172033", fontSize: 14, fontWeight: "500" },
  supportSubtitle: { color: "#858FA1", fontSize: 12, marginTop: 4, fontWeight: "400" },

  profileCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E8EE",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  profileAvatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#EEF4FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },
  profileAvatarText: { color: "#2563EB", fontSize: 19, fontWeight: "600" },
  profileName: { color: "#172033", fontSize: 15, fontWeight: "500" },
  profileEmail: { color: "#858FA1", fontSize: 12, marginTop: 4, fontWeight: "400" },
  settingsPanel: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E8EE",
    backgroundColor: "#FFFFFF",
  },
  settingsRow: {
    minHeight: 70,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E6E9EF",
    flexDirection: "row",
    alignItems: "center",
  },
  settingsRowTitle: { color: "#172033", fontSize: 14, fontWeight: "500" },
  settingsRowSubtitle: { color: "#858FA1", fontSize: 12, marginTop: 4, fontWeight: "400" },
  settingsChevron: { color: "#A0A8B6", fontSize: 24, fontWeight: "400" },
  logoutCard: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#FFD6D6",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutCardText: { color: "#C24141", fontSize: 14, fontWeight: "500" },

  tabBarWrap: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: Platform.OS === "ios" ? 10 : 14,
  },
  glassTabBar: {
    minHeight: 72,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.92)",
    backgroundColor: "rgba(250,251,253,0.92)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 7,
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 14,
  },
  tabButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tabButtonActive: {
    backgroundColor: "rgba(37,99,235,0.09)",
  },
  tabIconWrap: {
    height: 25,
    minWidth: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconWrapActive: {
    transform: [{ scale: 1.03 }],
  },
  tabIcon: {
    color: "#7F8898",
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "400",
  },
  tabIconActive: { color: "#2563EB" },
  tabLabel: {
    marginTop: 3,
    color: "#7F8898",
    fontSize: 10,
    fontWeight: "400",
  },
  tabLabelActive: { color: "#2563EB", fontWeight: "500" },

  header: {
    minHeight: 70,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E8EE",
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 34, color: "#2563EB", lineHeight: 36, fontWeight: "400" },
  headerText: { flex: 1, paddingRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: "600", color: "#172033" },
  headerSubtitle: { marginTop: 2, color: "#7D8798", fontSize: 12, fontWeight: "400" },

  menuContent: { padding: 16, paddingBottom: 40 },
  menuGroup: { marginBottom: 22 },
  menuGroupTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#7D8798",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  menuRow: {
    minHeight: 72,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E8EE",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  menuRowTitle: { fontSize: 15, fontWeight: "500", color: "#172033" },
  menuRowDescription: { fontSize: 12, color: "#858FA1", marginTop: 4, fontWeight: "400" },
  menuChevron: { fontSize: 26, color: "#A0A8B6", fontWeight: "400" },

  moduleContent: { padding: 16, paddingBottom: 40 },
  recordCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E8EE",
    backgroundColor: "#FFFFFF",
    padding: 14,
    marginBottom: 10,
  },
  recordTitle: { fontSize: 15, fontWeight: "500", color: "#172033" },
  recordSubtitle: { marginTop: 5, color: "#858FA1", fontSize: 13, fontWeight: "400" },
  recordMeta: { marginTop: 10, color: "#667085", fontSize: 12, fontWeight: "400" },
  settingRow: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E8EE",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingKey: {
    flex: 1,
    color: "#858FA1",
    fontSize: 12,
    fontWeight: "400",
    textTransform: "capitalize",
  },
  settingValue: {
    flex: 1,
    color: "#172033",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "right",
  },

  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E8EE",
    backgroundColor: "#FFFFFF",
    padding: 22,
    alignItems: "center",
  },
  emptyTitle: { fontWeight: "500", color: "#172033", fontSize: 15 },
  emptyText: { paddingTop: 7, color: "#858FA1", textAlign: "center", fontSize: 13, fontWeight: "400" },
  loader: { marginVertical: 36 },
  errorBox: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FDA29B",
    backgroundColor: "#FEF3F2",
    marginBottom: 14,
  },
  errorText: { color: "#B42318", fontWeight: "400", fontSize: 13 },
});
