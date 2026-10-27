import type { Metadata } from "next";
import { BuyCheck } from "@/components/check/BuyCheck";

export const metadata: Metadata = { title: "Should I buy this? · fitcheck" };

export default function CheckPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Should I buy this?</h1>
        <p className="opacity-70">Show us the item and we&apos;ll check it against your closet.</p>
      </div>
      <BuyCheck />
    </div>
  );
}
