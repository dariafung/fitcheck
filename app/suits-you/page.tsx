import { Suspense } from "react";
import { SuitsYou, SuitsYouSkeleton } from "@/components/closet/suits-you";

export default function SuitsYouPage() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-medium">Suits you</h1>
        <p className="text-sm text-ink-2">Secondhand, from other people&apos;s closets</p>
      </div>
      <Suspense fallback={<SuitsYouSkeleton />}>
        <SuitsYou />
      </Suspense>
    </div>
  );
}
