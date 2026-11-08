// Scheduled campaigns use the Turkey wall clock (UTC+03:00) even if the
// server runs in UTC or the admin opens the panel from another time zone.
export type NotificationRepeatUnit = "day" | "week" | "month";

const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function parseNotificationRepeat(
  unit: unknown,
  every: unknown,
): { unit: NotificationRepeatUnit | null; every: number; error?: string } {
  if (unit === undefined || unit === null || unit === "") {
    if (every !== undefined && every !== null && every !== "")
      return { unit: null, every: 1, error: "Tekrar aralığı için bir sıklık seçin" };
    return { unit: null, every: 1 };
  }
  if (unit !== "day" && unit !== "week" && unit !== "month")
    return { unit: null, every: 1, error: "Günlük, haftalık veya aylık tekrar seçin" };
  const count = every === undefined ? 1 : every;
  if (!Number.isSafeInteger(count) || (count as number) < 1 || (count as number) > 30)
    return { unit: null, every: 1, error: "Tekrar aralığı 1–30 arasında tam sayı olmalı" };
  return { unit, every: count as number };
}

/**
 * Return the first occurrence strictly AFTER `after`. The original date
 * anchors all occurrences: monthly plans on the 31st use each month's last
 * available day without drifting to the 28th forever.
 * Missed occurrences are skipped (no burst when the service restarts).
 */
export function nextNotificationOccurrence(
  anchor: Date | string,
  unit: NotificationRepeatUnit,
  every: number,
  after: Date = new Date(),
): Date {
  const start = new Date(anchor);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(after.getTime()))
    throw new Error("Tekrar tarihi geçersiz");
  if (!Number.isSafeInteger(every) || every < 1 || every > 30)
    throw new Error("Tekrar aralığı geçersiz");
  if (start.getTime() > after.getTime()) return start;

  if (unit === "day" || unit === "week") {
    const periodMs = (unit === "day" ? DAY_MS : DAY_MS * 7) * every;
    const steps = Math.floor((after.getTime() - start.getTime()) / periodMs) + 1;
    return new Date(start.getTime() + steps * periodMs);
  }
  if (unit !== "month") throw new Error("Tekrar sıklığı geçersiz");

  const localStart = new Date(start.getTime() + ISTANBUL_OFFSET_MS);
  const localAfter = new Date(after.getTime() + ISTANBUL_OFFSET_MS);
  const firstMonth = localStart.getUTCFullYear() * 12 + localStart.getUTCMonth();
  const afterMonth = localAfter.getUTCFullYear() * 12 + localAfter.getUTCMonth();
  let index = Math.max(0, Math.floor((afterMonth - firstMonth) / every));
  for (;;) {
    const month = firstMonth + index * every;
    const year = Math.floor(month / 12);
    const monthIndex = month - year * 12;
    const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const day = Math.min(localStart.getUTCDate(), lastDay);
    const occurrence = new Date(Date.UTC(
      year, monthIndex, day,
      localStart.getUTCHours(), localStart.getUTCMinutes(),
      localStart.getUTCSeconds(), localStart.getUTCMilliseconds(),
    ) - ISTANBUL_OFFSET_MS);
    if (occurrence.getTime() > after.getTime()) return occurrence;
    index += 1;
  }
}
