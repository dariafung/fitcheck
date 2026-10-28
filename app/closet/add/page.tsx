import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ReadOnlyNote } from "@/components/auth/read-only-note";
import { AddByScreenshot } from "@/components/entry/AddByScreenshot";
import { isReadOnly } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Add clothes · fitcheck" };

// The uploader stays in the static shell so it works as soon as the page
// loads. For the demo account a note streams in and hides it.
export default function AddPage() {
  return (
    <div className="group/add flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Add clothes</h1>
        <p className="opacity-70">Show us a screenshot and we&apos;ll fill in the details.</p>
      </div>
      <Suspense>
        <DemoNote />
      </Suspense>
      <div className="group-has-[[data-read-only]]/add:hidden">
        <AddByScreenshot />
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
