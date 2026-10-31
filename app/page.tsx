import { Suspense } from "react";
import { GoodForToday, GoodForTodaySkeleton } from "@/components/closet/good-for-today";
import { StyleCard } from "@/components/closet/style-card";
import { StyleCardSkeleton } from "@/components/closet/style-card-view";

// The purchase check is the black button in the top bar. Home is what you
// own: the style card in the left column, today's pick beside it. Phone order
// follows the markup: today first, then the card.
export default function Home() {
  return (
    <div className="grid gap-x-4 gap-y-16 lg:grid-cols-4">
      <h1 className="sr-only">fitcheck</h1>
      <div className="min-w-0 lg:col-span-3 lg:col-start-2 lg:row-start-1">
        <Suspense fallback={<GoodForTodaySkeleton />}>
          <GoodForToday />
        </Suspense>
      </div>
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">
        <Suspense fallback={<StyleCardSkeleton />}>
          <StyleCard />
        </Suspense>
      </div>
    </div>
  );
}
