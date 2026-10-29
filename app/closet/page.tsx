import Link from "next/link";
import { Suspense } from "react";
import { ClosetGrid, ClosetGridSkeleton } from "@/components/closet/closet-grid";
import { closetView } from "@/lib/closet/tabs";

// /closet/add belongs to the entry lane.
export default function ClosetPage({ searchParams }: PageProps<"/closet">) {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-xl font-medium">Your closet</h1>
        <Link href="/closet/add" className="btn-secondary shrink-0">
          Add clothes
        </Link>
      </div>
      <Suspense fallback={<ClosetGridSkeleton tabs />}>
        <ClosetGrid view={searchParams.then(closetView)} />
      </Suspense>
    </div>
  );
}
