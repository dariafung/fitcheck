import Link from "next/link";
import { connection } from "next/server";
import { authRequired } from "@/lib/auth/config";
import { sessionUser } from "@/lib/auth/session";
import { DEMO_USER_ID } from "@/lib/db/demo-user";
import { wearLogEnabledFor } from "@/lib/wear/settings";

// "Calendar" in the top bar, unless the calendar is turned off in Profile.
// Reads the session itself, not currentUserId(): that would send the
// signed-out login page to /login again.
export async function CalendarNavLink({ className }: { className: string }) {
  await connection();
  let userId = DEMO_USER_ID;
  if (authRequired()) {
    const user = await sessionUser();
    if (!user) return null;
    userId = user.id;
  }
  if (!(await wearLogEnabledFor(userId))) return null;
  return (
    <Link href="/calendar" className={className}>
      Calendar
    </Link>
  );
}
