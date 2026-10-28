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
      <Link href="/login" className="pl-2 hover:underline">
        Log in
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-3 pl-2">
      {user.readOnly && (
        <Link href="/signup" className="font-medium hover:underline">
          Sign up
        </Link>
      )}
      <form action={logOut}>
        <button type="submit" className="text-foreground/60 hover:text-foreground hover:underline">
          Log out
        </button>
      </form>
    </div>
  );
}
