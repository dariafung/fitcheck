import { createServerClient } from "@/lib/db/server";
import type { BudgetStore } from "./budget";

// The ai_budget_days table, through the ai_reserve / ai_settle functions so
// concurrent calls cannot overspend.
export function dbBudgetStore(): BudgetStore {
  return {
    async reserve(day, usd, limit) {
      const { data } = await createServerClient()
        .rpc("ai_reserve", { p_day: day, p_usd: usd, p_limit: limit })
        .throwOnError();
      return data === true;
    },
    async settle(day, usd) {
      await createServerClient().rpc("ai_settle", { p_day: day, p_usd: usd }).throwOnError();
    },
    async spent(day) {
      const { data } = await createServerClient()
        .from("ai_budget_days")
        .select("spent_usd")
        .eq("day", day)
        .maybeSingle()
        .throwOnError();
      return data ? Number(data.spent_usd) : 0;
    },
  };
}
