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
      <Link href="/login" className="text-sm text-ink-2 transition-colors duration-150 hover:text-ink">
        Log in
      </Link>
    );
  }
  // Not on a phone: it's at the bottom of Profile there (PhoneLogOut).
  return (
    <form action={logOut} className="hidden md:block">
      <LogOutButton />
    </form>
  );
}

// Bottom of Profile on a phone, where the top bar has no room for it.
export async function PhoneLogOut() {
  await connection();
  if (!authRequired() || !(await sessionUser())) return null;
  return (
    <form action={logOut} className="md:hidden">
      <LogOutButton />
    </form>
  );
}

function LogOutButton() {
  return (
    <button type="submit" className="cursor-pointer text-sm text-ink-2 transition-colors duration-150 hover:text-ink">
      Log out
    </button>
  );
}
