"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { listingText } from "@/lib/resale/listing";
import { sizeLabel } from "@/lib/resale/size";
import { ListingForm, type Listing } from "./listing-form";
import { patchItem } from "./size-form";

export const UNREADABLE_SIZE = "We can't read this size, so buyers aren't filtered by size.";

// "Size M · Asking $25 · Like new · Edit" under the Passing on notice.
// `readable` says whether code could read the size for matching buyers.
export function ItemSize({
  itemId,
  size,
  askingPriceCents,
  condition,
  readable,
  readOnly,
}: {
  itemId: string;
  size: string | null;
  askingPriceCents: number | null;
  condition: string | null;
  readable: boolean;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [, startRefresh] = useTransition();

  async function save(listing: Listing): Promise<string | null> {
    const failed = await patchItem(itemId, listing);
    if (!failed) {
      startRefresh(() => {
        setEditing(false);
        router.refresh();
      });
    }
    return failed;
  }

  if (editing) {
    return (
      <ListingForm
        initial={{ size, askingPriceCents, condition }}
        submitLabel="Save listing"
        busyLabel="Saving…"
        onSave={save}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const listing = listingText(askingPriceCents, condition);
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="flex flex-wrap items-center gap-x-2">
        <span>{size ? sizeLabel(size) : "No size yet"}</span>
        <span aria-hidden className="text-ink-2">
          ·
        </span>
        <span>{listing ?? "No price yet"}</span>
        {!readOnly && (
          <>
            <span aria-hidden className="text-ink-2">
              ·
            </span>
            <button type="button" onClick={() => setEditing(true)} className="btn-text">
              {size && listing ? "Edit" : "Add details"}
            </button>
          </>
        )}
      </p>
      {size && !readable && <p className="text-ink-2">{UNREADABLE_SIZE}</p>}
    </div>
  );
}
