import Link from "next/link";
import { Suspense } from "react";
import { GoodForToday, GoodForTodaySkeleton } from "@/components/closet/good-for-today";
import { StyleCard } from "@/components/closet/style-card";
import { StyleCardSkeleton } from "@/components/closet/style-card-view";

// /check belongs to the check lane; home only links to it.
// Home is one shelf: the first slot is the thing you haven't bought yet (the
// black tile), the rest is what you already own that suits today.
export default function Home() {
  return (
    <div className="grid gap-x-4 gap-y-16 lg:grid-cols-4">
      <h1 className="sr-only">fitcheck</h1>
      <Link
        href="/check"
        className="group flex min-h-56 flex-col justify-between gap-10 bg-ink p-6 text-paper transition-colors duration-150 ease-quiet hover:bg-press md:min-h-64 md:p-8 lg:mt-[72px] lg:aspect-[4/5] lg:min-h-0 lg:p-6 xl:p-8"
      >
        <span className="block max-w-[11ch] text-[32px] leading-[1.05] font-medium tracking-[-0.015em] md:text-2xl">
          Should I buy this?
        </span>
        <span className="block max-w-[26ch] font-serif text-lg text-paper/75">
          See if it works with what you already own.
        </span>
      </Link>
      <div className="min-w-0 lg:col-span-3">
        <Suspense fallback={<GoodForTodaySkeleton />}>
          <GoodForToday />
        </Suspense>
      </div>
      <div className="min-w-0 lg:col-span-4">
        <Suspense fallback={<StyleCardSkeleton />}>
          <StyleCard />
        </Suspense>
      </div>
    </div>
  );
}
