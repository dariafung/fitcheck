import { createServerClient } from "@/lib/db/server";
import type { UsageStore } from "./usage-store";

// The ai_usage_days table, through the ai_take / ai_give_back functions so
// concurrent requests cannot pass a limit.
export function dbUsageStore(): UsageStore {
  return {
    async take(subject, day, action, limit) {
      const { data } = await createServerClient()
        .rpc("ai_take", { p_subject: subject, p_day: day, p_action: action, p_limit: limit })
        .throwOnError();
      return data === true;
    },
    async giveBack(subject, day, action) {
      await createServerClient()
        .rpc("ai_give_back", { p_subject: subject, p_day: day, p_action: action })
        .throwOnError();
    },
  };
}
