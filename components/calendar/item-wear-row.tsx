import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { chicagoDay, shortDay } from "@/lib/wear/day";
import { loadItemWear } from "@/lib/wear/log";
import { wearLogEnabledFor } from "@/lib/wear/settings";
import { timesWorn } from "./wear-stats";

// The item page's "Worn" line, in the same rows as its tags. Left out when
// the calendar is off or nothing is logged yet.
export async function ItemWearRow({ itemId }: { itemId: string }) {
  const userId = await currentUserId();
  if (!(await wearLogEnabledFor(userId))) return null;
  const wear = await loadItemWear(createServerClient(), userId, itemId);
  if (!wear) return null;
  const span = wear.window.to >= chicagoDay() ? "in the last 30 days" : `in the 30 days to ${shortDay(wear.window.to)}`;
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 border-b border-line py-3">
      <dt className="text-ink-2">Worn</dt>
      <dd>
        {timesWorn(wear.count)} {span}
        {wear.lastWorn && `, last on ${shortDay(wear.lastWorn)}`}
      </dd>
    </div>
  );
}
