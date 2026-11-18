/** Products receive the "Yeni Geldi" label only for the first 24 hours after creation. */
export const NEW_ARRIVAL_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * Use the persisted product creation timestamp, never updated_at: editing,
 * changing stock or setting a campaign must not restart the new-arrival window.
 */
export function newArrivalExpiry(createdAt: string | null | undefined): number | null {
  if (!createdAt || typeof createdAt !== "string") return null;
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return null;
  const expires = created + NEW_ARRIVAL_DURATION_MS;
  return Number.isFinite(expires) ? expires : null;
}

export function isNewArrival(createdAt: string | null | undefined, now = Date.now()): boolean {
  const expires = newArrivalExpiry(createdAt);
  if (expires === null || !Number.isFinite(now)) return false;
  const created = expires - NEW_ARRIVAL_DURATION_MS;
  // Future timestamps, absent dates and expired 24-hour windows show no label.
  return now >= created && now < expires;
}
