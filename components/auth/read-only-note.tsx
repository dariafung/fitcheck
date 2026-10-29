import Link from "next/link";

// Stands in for edit buttons on the read-only demo account. The text reads
// exactly DEMO_READ_ONLY in lib/auth/messages.ts.
export function ReadOnlyNote() {
  return (
    <p className="rounded-xl bg-black/[.04] px-4 py-3 text-sm text-foreground/70 dark:bg-white/[.06]">
      Demo account is read-only.{" "}
      <Link href="/signup" className="font-medium text-foreground underline underline-offset-2">
        Sign up
      </Link>{" "}
      to add your own.
    </p>
  );
}
