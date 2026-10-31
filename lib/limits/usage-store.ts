// Where the daily AI counts are kept: the ai_usage_days table. Tests swap in
// memoryUsageStore(). Its own module so test setup can swap it without
// loading the session code.
import { dbUsageStore } from "./usage-db";

export interface UsageStore {
  // Adds 1 to the count unless that would pass limit. False if not.
  take(subject: string, day: string, action: string, limit: number): Promise<boolean>;
  // Takes 1 back, never below 0.
  giveBack(subject: string, day: string, action: string): Promise<void>;
}

let store: UsageStore | undefined;

export function usageStore(): UsageStore {
  return (store ??= dbUsageStore());
}

// Test hook.
export function setUsageStore(next: UsageStore): void {
  store = next;
}

export function memoryUsageStore(): UsageStore {
  const counts = new Map<string, number>();
  const key = (subject: string, day: string, action: string) => `${subject}|${day}|${action}`;
  return {
    async take(subject, day, action, limit) {
      const k = key(subject, day, action);
      const count = counts.get(k) ?? 0;
      if (count >= limit) return false;
      counts.set(k, count + 1);
      return true;
    },
    async giveBack(subject, day, action) {
      const k = key(subject, day, action);
      counts.set(k, Math.max(0, (counts.get(k) ?? 0) - 1));
    },
  };
}

