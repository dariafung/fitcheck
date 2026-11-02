import Link from "next/link";
import { Suspense } from "react";
import { ClosetGrid, ClosetGridSkeleton } from "@/components/closet/closet-grid";
import { closetView } from "@/lib/closet/tabs";

// /closet/add belongs to the entry lane. An empty closet has one way in, the
// empty slot's own button, so the header's goes once that shows.
export default function ClosetPage({ searchParams }: PageProps<"/closet">) {
  return (
    <div className="group/closet flex flex-col gap-10">
      {/* Held at the button's height, so nothing moves when it goes. */}
      <div className="flex min-h-11 items-end justify-between gap-4">
        <h1 className="text-xl font-medium">Your closet</h1>
        <Link href="/closet/add" className="btn-secondary shrink-0 group-has-[[data-empty-closet]]/closet:hidden">
          Add clothes
        </Link>
      </div>
      <Suspense fallback={<ClosetGridSkeleton tabs />}>
        <ClosetGrid view={searchParams.then(closetView)} />
      </Suspense>
    </div>
  );
}
