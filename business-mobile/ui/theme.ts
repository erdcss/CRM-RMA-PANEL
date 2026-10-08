export const C = {
  bg: "#05080C",
  bg2: "#0A0F15",
  panel: "#0E151D",
  panel2: "#111A24",
  panelSoft: "rgba(18,27,37,0.86)",
  line: "#25303C",
  lineSoft: "rgba(255,255,255,0.09)",
  text: "#F7F8FA",
  text2: "#B8C0CC",
  muted: "#7E8998",
  blue: "#3B82F6",
  blueSoft: "rgba(59,130,246,0.16)",
  green: "#34D399",
  greenSoft: "rgba(52,211,153,0.15)",
  orange: "#F59E0B",
  orangeSoft: "rgba(245,158,11,0.15)",
  red: "#FB7185",
  redSoft: "rgba(251,113,133,0.15)",
  white10: "rgba(255,255,255,0.10)",
  white06: "rgba(255,255,255,0.06)",
  black72: "rgba(0,0,0,0.72)",
};

export const R = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
};

export function money(value: unknown) {
  const number = Number(value || 0);
  return `${number.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₺`;
}

export function shortDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function statusMeta(status?: string | null) {
  const key = String(status || "").toLowerCase();
  if (["delivered", "completed", "teslim_edildi"].includes(key)) {
    return { label: "Teslim Edildi", fg: C.green, bg: C.greenSoft };
  }
  if (["shipped", "cargo", "kargoda"].includes(key)) {
    return { label: "Kargoda", fg: C.blue, bg: C.blueSoft };
  }
  if (["cancelled", "canceled", "cancel_requested", "iptal"].includes(key)) {
    return { label: "İade / İptal", fg: C.red, bg: C.redSoft };
  }
  if (["approved", "confirmed", "paid", "onaylandi"].includes(key)) {
    return { label: "Onaylandı", fg: C.green, bg: C.greenSoft };
  }
  return { label: "Beklemede", fg: C.orange, bg: C.orangeSoft };
}

export function segmentMeta(segment?: string | null) {
  const key = String(segment || "aktif").toLowerCase();
  if (key === "vip") return { label: "VIP", fg: C.orange, bg: C.orangeSoft };
  if (key === "riskli") return { label: "Riskli", fg: C.red, bg: C.redSoft };
  if (key === "yeni") return { label: "Yeni", fg: C.blue, bg: C.blueSoft };
  return { label: "Aktif", fg: C.green, bg: C.greenSoft };
}
