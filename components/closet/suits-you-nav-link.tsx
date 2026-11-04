import { connection } from "next/server";
import { NavLink } from "@/components/nav/nav-link";
import { authRequired } from "@/lib/auth/config";
import { sessionUser } from "@/lib/auth/session";
import { DEMO_USER_ID } from "@/lib/db/demo-user";
import { resaleOptedInFor } from "@/lib/resale/feed";

// "Suits you" in the top bar, unless the user turned resale matching off in
// Profile. Reads the session itself, not currentUserId(): that would send the
// signed-out login page to /login again.
export async function SuitsYouNavLink({ className }: { className: string }) {
  await connection();
  let userId = DEMO_USER_ID;
  if (authRequired()) {
    const user = await sessionUser();
    if (!user) return null;
    userId = user.id;
  }
  if (!(await resaleOptedInFor(userId))) return null;
  return (
    <NavLink href="/suits-you" className={className}>
      Suits you
    </NavLink>
  );
}
