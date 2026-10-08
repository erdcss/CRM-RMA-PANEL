import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { MainTab } from "../types";
import { C } from "../ui/theme";

const tabs: Array<{ key: MainTab; label: string; icon: string }> = [
  { key: "dashboard", label: "Ana Sayfa", icon: "⌂" },
  { key: "orders", label: "Siparişler", icon: "▱" },
  { key: "products", label: "Ürünler", icon: "□" },
  { key: "customers", label: "Müşteriler", icon: "◎" },
  { key: "more", label: "Daha Fazla", icon: "•••" },
];

export function GlassTabBar({
  active,
  onTab,
}: {
  active: MainTab;
  onTab: (tab: MainTab) => void;
}) {
  return (
    <View style={s.wrap} pointerEvents="box-none">
      <View style={s.glass}>
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <TouchableOpacity
              key={tab.key}
              style={s.button}
              activeOpacity={0.72}
              onPress={() => onTab(tab.key)}
            >
              <View style={[s.iconWrap, selected && s.iconWrapActive]}>
                <Text style={[s.icon, selected && s.active]}>{tab.icon}</Text>
              </View>
              <Text style={[s.label, selected && s.active]}>{tab.label}</Text>
              {selected ? <View style={s.indicator} /> : null}
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
    bottom: 8,
  },
  glass: {
    minHeight: 78,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(12,18,25,0.94)",
    flexDirection: "row",
    paddingHorizontal: 4,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
  },
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 58,
  },
  iconWrap: {
    height: 28,
    minWidth: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    borderRadius: 10,
    backgroundColor: "rgba(59,130,246,0.10)",
  },
  icon: {
    color: "#84909F",
    fontSize: 23,
    fontWeight: "400",
    lineHeight: 25,
  },
  label: {
    color: "#84909F",
    fontSize: 10,
    marginTop: 3,
    fontWeight: "400",
  },
  active: {
    color: C.blue,
    fontWeight: "600",
  },
  indicator: {
    width: 28,
    height: 3,
    marginTop: 5,
    borderRadius: 999,
    backgroundColor: C.blue,
  },
});
