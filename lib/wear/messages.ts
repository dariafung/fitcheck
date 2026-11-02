// Copy for the outfit calendar's errors, shared by the routes and the page.
// No server-only imports here: the client bundles this file.
import { DEMO_READ_ONLY } from "../auth/messages";
import { BACKFILL_DAYS, MAX_OUTFITS_PER_DAY } from "./day";

export const CALENDAR_OFF_ERROR = "calendar_off";

export const OUTFIT_ERRORS = {
  bad_request: "Pick at least one piece.",
  not_found: "That outfit isn't there anymore.",
  too_old: `You can only change the last ${BACKFILL_DAYS} days.`,
  unknown_items: "Some of those pieces aren't in your closet.",
  duplicate: "You already logged this outfit for that day.",
  day_full: `That's ${MAX_OUTFITS_PER_DAY} outfits for one day already.`,
  [CALENDAR_OFF_ERROR]: "Your outfit calendar is off. Turn it on in Profile.",
} as const;
export type OutfitError = keyof typeof OUTFIT_ERRORS;

export const OUTFIT_SAVE_FAILED = "Couldn't save. Try again.";

// What an error answer from the calendar routes should say on the page.
export async function outfitProblem(res: Response | null): Promise<string> {
  if (res?.status === 403) return DEMO_READ_ONLY;
  const json = (await res?.json().catch(() => null)) as { message?: string } | null;
  return json?.message ?? OUTFIT_SAVE_FAILED;
}
