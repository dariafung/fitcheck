import Link from "next/link";
import { Suspense } from "react";
import { ClosetGrid, ClosetGridSkeleton } from "@/components/closet/closet-grid";
import { closetTab } from "@/lib/closet/tabs";

// /closet/add belongs to the entry lane.
export default function ClosetPage({ searchParams }: PageProps<"/closet">) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Your closet</h1>
        <Link
          href="/closet/add"
          className="shrink-0 rounded-full border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06]"
        >
          Add clothes
        </Link>
      </div>
      <Suspense fallback={<ClosetGridSkeleton tabs />}>
        <ClosetGrid tab={searchParams.then((params) => closetTab(params.tab))} />
      </Suspense>
    </div>
  );
}
