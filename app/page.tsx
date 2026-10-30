import Link from "next/link";
import { Suspense } from "react";
import { GoodForToday, GoodForTodaySkeleton } from "@/components/closet/good-for-today";
import { StyleCard } from "@/components/closet/style-card";
import { StyleCardSkeleton } from "@/components/closet/style-card-view";

// /check belongs to the check lane; home only links to it.
export default function Home() {
  return (
    <div className="flex flex-col gap-10">
      <h1 className="sr-only">fitcheck</h1>
      <Link
        href="/check"
        className="block rounded-2xl bg-foreground px-6 py-8 text-background transition-opacity hover:opacity-90 sm:px-8 sm:py-10"
      >
        <span className="block text-2xl font-semibold sm:text-3xl">Should I buy this?</span>
        <span className="mt-1 block text-sm opacity-70">See if it works with what you already own.</span>
      </Link>
      <Suspense fallback={<GoodForTodaySkeleton />}>
        <GoodForToday />
      </Suspense>
      <Suspense fallback={<StyleCardSkeleton />}>
        <StyleCard />
      </Suspense>
    </div>
  );
}
