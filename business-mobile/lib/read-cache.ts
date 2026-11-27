// Short-lived, in-memory read cache. Never stores data on disk.
type Entry = { value: unknown; at: number };
export class BusinessReadCache {
  private scope = "";
  private epoch = 0;
  private entries = new Map<string, Entry>();
  private pending = new Map<string, Promise<unknown>>();
  private readonly freshMs: number;
  private readonly visibleMs: number;
  private readonly now: () => number;
  constructor(freshMs = 10000, visibleMs = 30000, now: () => number = Date.now) {
    this.freshMs = freshMs;
    this.visibleMs = visibleMs;
    this.now = now;
  }
  clear() {
    this.epoch++;
    this.entries.clear();
    this.pending.clear();
  }
  private switchScope(scope: string) {
    if (scope !== this.scope) { this.clear(); this.scope = scope; }
  }
  peek<T>(scope: string, key: string): T | undefined {
    this.switchScope(scope);
    const e = this.entries.get(key);
    if (!scope || !e || this.now() - e.at > this.visibleMs) return undefined;
    return e.value as T;
  }
  read<T>(scope: string, key: string, loader: () => Promise<T>, force = false): Promise<T> {
    this.switchScope(scope);
    if (!scope) return Promise.reject(new Error("Oturum bulunamadı"));
    const e = this.entries.get(key);
    if (!force && e && this.now() - e.at <= this.freshMs) return Promise.resolve(e.value as T);
    const pending = this.pending.get(key);
    if (pending) return pending as Promise<T>;
    const epoch = this.epoch;
    const promise = Promise.resolve().then(loader).then(value => {
      if (epoch === this.epoch && scope === this.scope) {
        this.entries.set(key, { value, at: this.now() });
        if (this.entries.size > 12) {
          const oldest = this.entries.keys().next().value;
          if (oldest !== undefined) this.entries.delete(oldest);
        }
      }
      return value;
    }).finally(() => {
      if (this.pending.get(key) === promise) this.pending.delete(key);
    });
    this.pending.set(key, promise);
    return promise;
  }
}
export const businessReadCache = new BusinessReadCache();
