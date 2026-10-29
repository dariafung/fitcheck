import Link from "next/link";
import { Suspense } from "react";
import { ItemDetail, ItemDetailSkeleton } from "@/components/closet/item-detail";

export default function ItemPage({ params }: PageProps<"/closet/[id]">) {
  return (
    <div className="-mt-4 flex flex-col gap-6 md:-mt-8">
      <Link
        href="/closet"
        className="self-start text-sm text-ink-2 transition-colors duration-150 hover:text-ink"
      >
        ← Closet
      </Link>
      <Suspense fallback={<ItemDetailSkeleton />}>
        <ItemDetail params={params} />
      </Suspense>
    </div>
  );
}
