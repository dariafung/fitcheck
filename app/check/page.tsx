import type { Metadata } from "next";
import { connection } from "next/server";
import { BuyCheck } from "@/components/check/BuyCheck";
import { isReadOnly } from "@/lib/auth/session";
import { currentTempUnit } from "@/lib/profile/temp-setting";

export const metadata: Metadata = { title: "Should I buy this? · fitcheck" };

// For "I bought it": the read-only demo account gets the read-only note.
// Waits for the request first, so a prerendered shell never reads the session.
function readOnlyAccount(): Promise<boolean> {
  return connection()
    .then(isReadOnly)
    .catch(() => false);
}

export default function CheckPage() {
  return (
    // Before an upload, the empty slot (left) and the question (right) share a
    // row; once there's an item, the question steps back above it. Sizes and
    // line heights come from the type scale: 28 on a phone, 40 on a desktop,
    // 18 once there's a result.
    <div className="group/check grid gap-10 md:grid-cols-12 md:gap-x-4">
      <div className="flex flex-col gap-3 md:col-span-12 md:group-has-[.dropzone]/check:col-span-5 md:group-has-[.dropzone]/check:col-start-7 md:group-has-[.dropzone]/check:row-start-1 md:group-has-[.dropzone]/check:pt-2">
        <h1 className="text-xl font-medium md:text-2xl group-has-[[aria-label=Result]]/check:text-lg group-has-[[aria-label=Result]]/check:tracking-normal group-has-[[aria-label=Result]]/check:text-ink-2">
          Should I buy this?
        </h1>
        <p className="text-base text-ink-2">Show us the item and we&apos;ll check it against your closet.</p>
      </div>
      <div className="min-w-0 md:col-span-12 md:group-has-[.dropzone]/check:col-span-5 md:group-has-[.dropzone]/check:col-start-1 md:group-has-[.dropzone]/check:row-start-1">
        <BuyCheck tempUnit={currentTempUnit()} readOnly={readOnlyAccount()} />
      </div>
    </div>
  );
}
