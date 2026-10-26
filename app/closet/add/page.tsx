import type { Metadata } from "next";
import { AddByScreenshot } from "@/components/entry/AddByScreenshot";

export const metadata: Metadata = { title: "Add clothes · fitcheck" };

export default function AddPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Add clothes</h1>
        <p className="opacity-70">Show us a screenshot and we&apos;ll fill in the details.</p>
      </div>
      <AddByScreenshot />
    </div>
  );
}
