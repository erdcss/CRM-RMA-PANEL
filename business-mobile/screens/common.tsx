import type { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { C } from "../ui/theme";

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={s.header}>
      <View style={s.headerText}>
        <Text style={s.title}>{title}</Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function BackHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  return (
    <View style={s.header}>
      <TouchableOpacity style={s.back} onPress={onBack}>
        <Text style={s.backText}>‹</Text>
      </TouchableOpacity>
      <View style={s.headerText}>
        <Text style={s.title}>{title}</Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.sectionRow}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action ? (
        <TouchableOpacity onPress={onAction}>
          <Text style={s.sectionAction}>{action} ›</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function Badge({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function MiniStat({
  icon,
  title,
  value,
  accent = C.text,
}: {
  icon: string;
  title: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <View style={s.stat}>
      <Text style={s.statIcon}>{icon}</Text>
      <Text style={s.statTitle}>{title}</Text>
      <Text style={[s.statValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    marginBottom: 22,
  },
  headerText: { flex: 1 },
  title: {
    color: C.text,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: "650",
    letterSpacing: -0.7,
  },
  subtitle: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    fontWeight: "400",
  },
  back: {
    width: 42,
    height: 42,
    marginRight: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: C.lineSoft,
    backgroundColor: C.white06,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { color: C.text, fontSize: 32, lineHeight: 33, fontWeight: "300" },
  sectionRow: {
    marginTop: 26,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { color: C.text, fontSize: 21, fontWeight: "600", letterSpacing: -0.3 },
  sectionAction: { color: C.text2, fontSize: 13, fontWeight: "400" },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontWeight: "600" },
  stat: {
    flex: 1,
    minWidth: 130,
    minHeight: 116,
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panelSoft,
  },
  statIcon: { color: C.text2, fontSize: 20, marginBottom: 12 },
  statTitle: { color: C.muted, fontSize: 12, fontWeight: "400" },
  statValue: { marginTop: 7, fontSize: 25, fontWeight: "600", letterSpacing: -0.6 },
  empty: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    alignItems: "center",
  },
  emptyTitle: { color: C.text, fontSize: 15, fontWeight: "600" },
  emptyText: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 6, textAlign: "center" },
});
