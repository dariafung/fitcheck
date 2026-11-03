import Link from "next/link";
import { Suspense } from "react";
import { GoodForToday, GoodForTodaySkeleton } from "@/components/closet/good-for-today";
import { StyleCard } from "@/components/closet/style-card";
import { StyleCardSkeleton } from "@/components/closet/style-card-view";
import { SuitsYou } from "@/components/closet/suits-you";

// Home opens with the way into the purchase check.
// Under it is what you own: the style card in the left column, today's pick
// beside it, then (for buyers with strong matches) what others are passing on
// that suits you. Phone order follows the markup: the check, today, Suits you,
// then the card.
export default function Home() {
  return (
    <div className="grid gap-x-4 gap-y-16 lg:grid-cols-4">
      <BuyCheckBanner />
      <div className="min-w-0 lg:col-span-3 lg:col-start-2 lg:row-start-2">
        <Suspense fallback={<GoodForTodaySkeleton />}>
          <GoodForToday />
        </Suspense>
      </div>
      <div className="min-w-0 empty:hidden lg:col-span-3 lg:col-start-2 lg:row-start-3">
        <Suspense fallback={null}>
          <SuitsYou />
        </Suspense>
      </div>
      <div className="min-w-0 lg:col-start-1 lg:row-start-2">
        <Suspense fallback={<StyleCardSkeleton />}>
          <StyleCard />
        </Suspense>
      </div>
    </div>
  );
}

// Home's title, set like the other pages' titles, with the button under it;
// only the button is black. Left-aligned from 768 px; centered with a
// full-width button on a phone.
function BuyCheckBanner() {
  return (
    <section
      aria-labelledby="home-title"
      className="flex min-w-0 flex-col items-center gap-6 text-center md:items-start md:text-left lg:col-span-4 lg:row-start-1 lg:mb-4"
    >
      <h1 id="home-title" className="text-xl font-medium">
        Thinking of buying something?
      </h1>
      <Link href="/check" className="btn-primary w-full md:w-auto">
        Should I buy this?
      </Link>
    </section>
  );
}
