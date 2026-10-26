import Link from "next/link";
import { Suspense } from "react";
import { ItemDetail, ItemDetailSkeleton } from "@/components/closet/item-detail";

export default function ItemPage({ params }: PageProps<"/closet/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/closet" className="self-start text-sm text-foreground/60 hover:underline">
        ← Closet
      </Link>
      <Suspense fallback={<ItemDetailSkeleton />}>
        <ItemDetail params={params} />
      </Suspense>
    </div>
  );
}
