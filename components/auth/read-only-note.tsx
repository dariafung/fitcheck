import Link from "next/link";

// Stands in for edit buttons on the read-only demo account. The text reads
// exactly DEMO_READ_ONLY in lib/auth/messages.ts. The link's padding makes
// it 44px tall to tap without moving the text.
export function ReadOnlyNote() {
  return (
    <p className="bg-tile px-4 py-3 text-sm text-ink-2">
      Demo account is read-only.{" "}
      <Link href="/signup" className="py-3.5 font-medium text-ink underline underline-offset-4">
        Sign up
      </Link>{" "}
      to add your own.
    </p>
  );
}
