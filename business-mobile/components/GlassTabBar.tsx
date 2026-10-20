import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MainTab } from "../types";
import { C } from "../ui/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

const tabs: Array<{ key: MainTab; label: string; icon: IconName; activeIcon: IconName }> = [
  { key: "dashboard", label: "Ana Sayfa", icon: "home-outline", activeIcon: "home" },
  { key: "orders", label: "Siparişler", icon: "receipt-outline", activeIcon: "receipt" },
  { key: "products", label: "Ürünler", icon: "cube-outline", activeIcon: "cube" },
  { key: "customers", label: "Müşteriler", icon: "people-outline", activeIcon: "people" },
  { key: "more", label: "Daha Fazla", icon: "grid-outline", activeIcon: "grid" },
];

export function GlassTabBar({
  active,
  onTab,
}: {
  active: MainTab;
  onTab: (tab: MainTab) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.wrap, { bottom: Math.max(8, insets.bottom + 4) }]} pointerEvents="box-none">
      <View style={s.glass} accessibilityRole="tablist">
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <TouchableOpacity
              key={tab.key}
              style={s.button}
              activeOpacity={0.72}
              onPress={() => onTab(tab.key)}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected }}
            >
              <View style={[s.iconWrap, selected && s.iconWrapActive]}>
                <Ionicons
                  name={selected ? tab.activeIcon : tab.icon}
                  size={23}
                  color={selected ? "#A6C7FF" : "#8D9BAA"}
                />
              </View>
              <Text style={[s.label, selected && s.active]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {tab.label}
              </Text>
              <View style={[s.indicator, !selected && s.indicatorHidden]} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 10,
    right: 10,
    zIndex: 50,
  },
  glass: {
    minHeight: 76,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(170,202,241,0.17)",
    backgroundColor: "rgba(12,19,29,0.97)",
    flexDirection: "row",
    paddingHorizontal: 5,
    paddingTop: 9,
    paddingBottom: 6,
    shadowColor: "#000",
    shadowOpacity: 0.48,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 18,
  },
  button: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 58,
    paddingHorizontal: 2,
  },
  iconWrap: {
    height: 32,
    width: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: "rgba(59,130,246,0.20)",
    borderWidth: 1,
    borderColor: "rgba(102,162,255,0.19)",
  },
  label: {
    color: "#99A8B9",
    fontSize: 10,
    marginTop: 3,
    fontWeight: "600",
    textAlign: "center",
  },
  active: {
    color: "#C1D7FF",
    fontWeight: "800",
  },
  indicator: {
    width: 17,
    height: 3,
    marginTop: 5,
    borderRadius: 99,
    backgroundColor: C.blue,
  },
  indicatorHidden: { backgroundColor: "transparent" },
});
