import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { signIn, signOut, type BusinessAuthUser } from "./lib/auth";
import { apiFetch } from "./lib/api";
import { ADMIN_MODULE_GROUPS, getAdminModule } from "./lib/admin-modules";
import { useMobileBranding } from "./lib/branding";

type Screen =
  | { name: "login" }
  | { name: "dashboard" }
  | { name: "menu" }
  | { name: "module"; slug: string };

type DashboardOverview = {
  sessionUsers: number;
  liveUsers: number;
  conversionRate: number;
  orderCount: number;
  activeReturns: number;
  recentOrders?: Array<{
    id: string | number;
    order_number?: string | null;
    customer_email?: string | null;
    status?: string | null;
    total_amount?: string | number | null;
  }>;
  recentReturns?: Array<{
    id: string | number;
    name?: string | null;
    brand?: string | null;
    customer_name?: string | null;
    status?: string | null;
  }>;
};

export default function App() {
  const branding = useMobileBranding();
  const [showSplash, setShowSplash] = useState(true);
  const [screen, setScreen] = useState<Screen>({ name: "login" });
  const [user, setUser] = useState<BusinessAuthUser | null>(null);

  useEffect(() => {
    if (!branding.loaded) return;
    const timer = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(timer);
  }, [branding.loaded, branding.business_mobile_splash]);

  return (
    <SafeAreaProvider>
      <StatusBar style={screen.name === "login" ? "light" : "dark"} />
      <View style={styles.root}>
        {screen.name === "login" ? (
          <LoginScreen
            logo={branding.business_mobile_logo}
            onSuccess={(nextUser) => {
              setUser(nextUser);
              setScreen({ name: "dashboard" });
            }}
          />
        ) : screen.name === "dashboard" ? (
          <DashboardScreen
            user={user}
            onMenu={() => setScreen({ name: "menu" })}
            onModule={(slug) => setScreen({ name: "module", slug })}
          />
        ) : screen.name === "menu" ? (
          <MenuScreen
            onBack={() => setScreen({ name: "dashboard" })}
            onDashboard={() => setScreen({ name: "dashboard" })}
            onModule={(slug) => setScreen({ name: "module", slug })}
            onLogout={async () => {
              await signOut();
              setUser(null);
              setScreen({ name: "login" });
            }}
          />
        ) : (
          <ModuleScreen
            slug={screen.slug}
            onBack={() => setScreen({ name: "menu" })}
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
            ) : branding.loaded ? (
              <Text style={styles.splashText}>Çalışkan Business</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </SafeAreaProvider>
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
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setMessage("E-posta ve şifrenizi eksiksiz girin.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const session = await signIn(normalizedEmail, password);
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
          keyboardDismissMode="interactive"
        >
          {logo ? (
            <Image source={{ uri: logo }} style={styles.loginLogo} resizeMode="contain" />
          ) : null}
          <Text style={styles.loginTitle}>Çalışkan Business</Text>

          <TextInput
            style={styles.input}
            placeholder="E-posta"
            placeholderTextColor="#737373"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="email"
            returnKeyType="next"
            value={email}
            onChangeText={setEmail}
          />

          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Şifre"
              placeholderTextColor="#737373"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              autoComplete="password"
              returnKeyType="go"
              value={password}
              onChangeText={setPassword}
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
  onMenu,
  onModule,
}: {
  user: BusinessAuthUser | null;
  onMenu: () => void;
  onModule: (slug: string) => void;
}) {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
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
    <SafeAreaView style={styles.adminScreen}>
      <View style={styles.topbar}>
        <View style={styles.topbarText}>
          <Text style={styles.brand}>Çalışkan Business</Text>
          <Text style={styles.smallMuted} numberOfLines={1}>
            {user?.email || user?.username || "Yönetici"}
          </Text>
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={onMenu}>
          <Text style={styles.primaryButtonText}>Menü</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
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
        <Text style={styles.kicker}>CANLI OPERASYON</Text>
        <Text style={styles.dashboardTitle}>Yönetim Dashboard</Text>
        <Text style={styles.dashboardSubtitle}>
          Admin web paneli ile aynı veri kaynağını kullanan mobil yönetim merkezi.
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator size="large" color="#1D4ED8" style={styles.loader} />
        ) : (
          <>
            <View style={styles.metrics}>
              <Metric title="Oturum Kullanıcısı" value={data?.sessionUsers ?? 0} />
              <Metric title="Canlı Kullanıcı" value={data?.liveUsers ?? 0} />
              <Metric
                title="Dönüşüm Oranı"
                value={`%${Number(data?.conversionRate ?? 0).toLocaleString("tr-TR", {
                  maximumFractionDigits: 1,
                })}`}
              />
              <Metric title="Bugünkü Sipariş" value={data?.orderCount ?? 0} />
              <Metric title="Aktif İade" value={data?.activeReturns ?? 0} />
            </View>

            <SectionTitle title="Hızlı İşlemler" />
            <View style={styles.quickGrid}>
              {[
                ["Siparişler", "siparisler"],
                ["Ürünler", "urunler"],
                ["Stok Durumu", "stok-durumu"],
                ["İade İşlemleri", "iade-islemleri"],
                ["Başvurular", "basvurular"],
                ["RMA Kayıtları", "kayitlar"],
              ].map(([title, slug]) => (
                <TouchableOpacity
                  key={slug}
                  style={styles.quickCard}
                  onPress={() => onModule(slug)}
                >
                  <Text style={styles.quickTitle}>{title}</Text>
                  <Text style={styles.quickArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>

            <SectionTitle title="Son Siparişler" />
            <View style={styles.panel}>
              {(data?.recentOrders || []).length === 0 ? (
                <Text style={styles.emptyText}>Henüz sipariş kaydı yok.</Text>
              ) : (
                data?.recentOrders?.slice(0, 6).map((order) => (
                  <View key={String(order.id)} style={styles.listRow}>
                    <View style={styles.listMain}>
                      <Text style={styles.listTitle}>
                        {order.order_number || `#${order.id}`}
                      </Text>
                      <Text style={styles.smallMuted}>
                        {order.customer_email || "—"}
                      </Text>
                    </View>
                    <View style={styles.listSide}>
                      <Text style={styles.amount}>
                        {Number(order.total_amount || 0).toLocaleString("tr-TR")} ₺
                      </Text>
                      <Text style={styles.smallMuted}>
                        {order.status || "Bekliyor"}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            <SectionTitle title="Son İadeler" />
            <View style={styles.panel}>
              {(data?.recentReturns || []).length === 0 ? (
                <Text style={styles.emptyText}>Henüz iade kaydı yok.</Text>
              ) : (
                data?.recentReturns?.slice(0, 5).map((item) => (
                  <View key={String(item.id)} style={styles.listRow}>
                    <View style={styles.listMain}>
                      <Text style={styles.listTitle}>
                        {item.name || item.brand || `İade #${item.id}`}
                      </Text>
                      <Text style={styles.smallMuted}>
                        {item.customer_name || "—"}
                      </Text>
                    </View>
                    <Text style={styles.smallMuted}>{item.status || "Bekliyor"}</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuScreen({
  onBack,
  onDashboard,
  onModule,
  onLogout,
}: {
  onBack: () => void;
  onDashboard: () => void;
  onModule: (slug: string) => void;
  onLogout: () => void | Promise<void>;
}) {
  return (
    <SafeAreaView style={styles.adminScreen}>
      <Header title="Tüm Modüller" subtitle="Çalışkan Admin mobil yönetim menüsü" onBack={onBack} />
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

        <TouchableOpacity style={styles.logoutButton} onPress={() => void onLogout()}>
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </ScrollView>
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
      <SafeAreaView style={styles.adminScreen}>
        <Header title="Modül bulunamadı" onBack={onBack} />
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
    <SafeAreaView style={styles.adminScreen}>
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
          <ActivityIndicator size="large" color="#1D4ED8" style={styles.loader} />
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
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Kayıt bulunamadı</Text>
            <Text style={styles.emptyText}>Admin web ile aynı veri kaynağı kontrol edildi.</Text>
          </View>
        ) : null}

        {!module.endpoint ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{module.title}</Text>
            <Text style={styles.emptyText}>
              Bu modülün mobil işlem ekranı hazırlanıyor. Menü ve yetki yapısı admin paneliyle eşlendi.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
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
  root: { flex: 1, backgroundColor: "#F8F9FA" },
  flex: { flex: 1 },
  splash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B0B0B",
  },
  splashImage: { width: "82%", height: "82%" },
  splashText: { color: "#FFF", fontSize: 28, fontWeight: "800" },

  loginScreen: { flex: 1, backgroundColor: "#0B0B0B" },
  loginContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 36,
  },
  loginLogo: {
    width: 104,
    height: 104,
    alignSelf: "center",
    marginBottom: 18,
  },
  loginTitle: {
    color: "#FFF",
    fontSize: 28,
    fontWeight: "800",
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
  },
  showButton: { paddingHorizontal: 15, paddingVertical: 14 },
  showButtonText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
  loginButton: {
    minHeight: 54,
    borderRadius: 13,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonText: { color: "#111", fontWeight: "800", fontSize: 16 },
  loginError: { color: "#FFB4B4", marginTop: 12, lineHeight: 20 },
  disabled: { opacity: 0.6 },

  adminScreen: { flex: 1, backgroundColor: "#F8F9FA" },
  topbar: {
    minHeight: 64,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E5E9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topbarText: { flex: 1, paddingRight: 12 },
  brand: { fontSize: 18, fontWeight: "900", color: "#18212F" },
  primaryButton: {
    minHeight: 38,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: "#1D4ED8",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: "#FFF", fontWeight: "800", fontSize: 13 },
  dashboardContent: { padding: 16, paddingBottom: 42 },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1D4ED8",
    letterSpacing: 1.1,
  },
  dashboardTitle: {
    marginTop: 5,
    fontSize: 28,
    fontWeight: "900",
    color: "#18212F",
  },
  dashboardSubtitle: {
    marginTop: 7,
    color: "#667085",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 18,
  },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: {
    width: "48%",
    minHeight: 96,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E2E5E9",
  },
  metricTitle: { color: "#667085", fontSize: 12, fontWeight: "600" },
  metricValue: {
    marginTop: 11,
    color: "#18212F",
    fontSize: 25,
    fontWeight: "900",
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 10,
    fontSize: 18,
    color: "#18212F",
    fontWeight: "900",
  },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickCard: {
    width: "48%",
    minHeight: 64,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#E2E5E9",
    backgroundColor: "#FFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quickTitle: { color: "#18212F", fontWeight: "800", fontSize: 13 },
  quickArrow: { color: "#1D4ED8", fontSize: 24 },
  panel: {
    overflow: "hidden",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E5E9",
    backgroundColor: "#FFF",
  },
  listRow: {
    minHeight: 70,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E5E9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listMain: { flex: 1, paddingRight: 12 },
  listSide: { alignItems: "flex-end" },
  listTitle: { color: "#18212F", fontWeight: "800", fontSize: 14 },
  amount: { color: "#18212F", fontWeight: "800", fontSize: 13 },
  smallMuted: { color: "#667085", fontSize: 11, marginTop: 3 },
  emptyText: { padding: 18, color: "#667085", textAlign: "center", fontSize: 13 },
  loader: { marginVertical: 36 },

  header: {
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E5E9",
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { fontSize: 36, color: "#1D4ED8", lineHeight: 38 },
  headerText: { flex: 1, paddingRight: 12 },
  headerTitle: { fontSize: 21, fontWeight: "900", color: "#18212F" },
  headerSubtitle: { marginTop: 2, color: "#667085", fontSize: 12 },

  menuContent: { padding: 16, paddingBottom: 40 },
  menuGroup: { marginBottom: 22 },
  menuGroupTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#667085",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  menuRow: {
    minHeight: 72,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E5E9",
    borderRadius: 14,
    backgroundColor: "#FFF",
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  menuRowTitle: { fontSize: 16, fontWeight: "800", color: "#18212F" },
  menuRowDescription: { fontSize: 12, color: "#667085", marginTop: 4 },
  menuChevron: { fontSize: 28, color: "#98A2B3" },
  logoutButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D92D20",
  },
  logoutText: { color: "#D92D20", fontWeight: "800" },

  moduleContent: { padding: 16, paddingBottom: 40 },
  recordCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E5E9",
    backgroundColor: "#FFF",
    padding: 14,
    marginBottom: 10,
  },
  recordTitle: { fontSize: 15, fontWeight: "800", color: "#18212F" },
  recordSubtitle: { marginTop: 5, color: "#667085", fontSize: 13 },
  recordMeta: { marginTop: 10, color: "#344054", fontSize: 12, fontWeight: "700" },
  settingRow: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E5E9",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingKey: {
    flex: 1,
    color: "#667085",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  settingValue: {
    flex: 1,
    color: "#18212F",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E5E9",
    backgroundColor: "#FFF",
    padding: 22,
    alignItems: "center",
  },
  emptyTitle: { fontWeight: "800", color: "#18212F" },
  errorBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDA29B",
    backgroundColor: "#FEF3F2",
    marginBottom: 14,
  },
  errorText: { color: "#B42318", fontWeight: "600", fontSize: 13 },
});
