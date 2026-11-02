import Link from "next/link";
import { Suspense } from "react";
import { ItemDetail, ItemDetailSkeleton } from "@/components/closet/item-detail";
import { Icon } from "@/components/ui/icon";

export default function ItemPage({ params }: PageProps<"/closet/[id]">) {
  return (
    <div className="-mt-6 flex flex-col gap-4 md:-mt-10">
      <Link
        href="/closet"
        className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start text-sm text-ink-2 transition-colors duration-150 hover:text-ink"
      >
        <Icon name="chevron-left" />
        Closet
      </Link>
      <Suspense fallback={<ItemDetailSkeleton />}>
        <ItemDetail params={params} />
      </Suspense>
    </div>
  );
}
