"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sizeLabel } from "@/lib/resale/size";
import { patchItem, SizeForm } from "./size-form";

export const UNREADABLE_SIZE = "We can't read this size, so buyers aren't filtered by size.";

// "Size M · Edit size" under the Passing on notice. `readable` says whether
// code could read the size for matching buyers.
export function ItemSize({
  itemId,
  size,
  readable,
  readOnly,
}: {
  itemId: string;
  size: string | null;
  readable: boolean;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [, startRefresh] = useTransition();

  async function save(typed: string): Promise<string | null> {
    const failed = await patchItem(itemId, { size: typed });
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
      <SizeForm
        initial={size ?? ""}
        submitLabel="Save size"
        busyLabel="Saving…"
        onSave={save}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="flex flex-wrap items-center gap-x-2">
        <span>{size ? sizeLabel(size) : "No size yet"}</span>
        {!readOnly && (
          <>
            <span aria-hidden className="text-ink-2">
              ·
            </span>
            <button type="button" onClick={() => setEditing(true)} className="btn-text">
              {size ? "Edit size" : "Add a size"}
            </button>
          </>
        )}
      </p>
      {size && !readable && <p className="text-ink-2">{UNREADABLE_SIZE}</p>}
    </div>
  );
}
