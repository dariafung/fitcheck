import Link from "next/link";
import { connection } from "next/server";
import { logOut } from "@/lib/auth/actions";
import { authRequired } from "@/lib/auth/config";
import { sessionUser } from "@/lib/auth/session";

// Right end of the top bar. Nothing with sign-in off. Always rendered per
// request, so one build works with sign-in on or off.
export async function AccountNav() {
  await connection();
  if (!authRequired()) return null;
  const user = await sessionUser();
  if (!user) {
    return (
      <Link href="/login" className="text-sm transition-colors duration-150 hover:text-ink-2">
        Log in
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-5">
      {user.readOnly && (
        // Not on a phone: the top bar has no room, and the read-only notes
        // link to sign-up too.
        <Link href="/signup" className="hidden text-sm font-medium underline underline-offset-4 transition-colors duration-150 hover:text-ink-2 md:inline">
          Sign up
        </Link>
      )}
      <form action={logOut}>
        <button type="submit" className="cursor-pointer text-sm text-ink-2 transition-colors duration-150 hover:text-ink">
          Log out
        </button>
      </form>
    </div>
  );
}
