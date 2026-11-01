import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found · fitcheck" };

// Any URL that isn't a page, and an item that was deleted.
export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="text-xl font-medium">Page not found</h1>
      <p className="text-base text-ink-2">It may have been moved or deleted.</p>
      <Link href="/closet" className="btn-secondary mt-7">
        Back to closet
      </Link>
    </div>
  );
}
