import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ReadOnlyNote } from "@/components/auth/read-only-note";
import { AddByScreenshot } from "@/components/entry/AddByScreenshot";
import { isReadOnly } from "@/lib/auth/session";
import { currentTempUnit } from "@/lib/profile/temp-setting";

export const metadata: Metadata = { title: "Add clothes · fitcheck" };

// The uploader stays in the static shell so it works as soon as the page
// loads. For the demo account a note streams in and hides it.
export default function AddPage() {
  return (
    <div className="slot-page group/add flex flex-col gap-10">
      <div className="slot-head flex flex-col gap-3">
        <h1 className="text-xl font-medium">Add clothes</h1>
        <p className="text-base text-ink-2">Show us a screenshot and we&apos;ll fill in the details.</p>
      </div>
      <Suspense>
        <DemoNote />
      </Suspense>
      <div className="slot-body min-w-0 group-has-[[data-read-only]]/add:hidden">
        <AddByScreenshot tempUnit={currentTempUnit()} />
      </div>
    </div>
  );
}

async function DemoNote() {
  await connection();
  if (!(await isReadOnly())) return null;
  return (
    <div data-read-only>
      <ReadOnlyNote />
    </div>
  );
}
