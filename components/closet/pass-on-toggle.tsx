"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ItemStatus } from "@/lib/closet/item-patch";
import { ListingForm } from "./listing-form";
import { patchItem } from "./size-form";

// Moves an item between worn (active) and Passing on, and back. No confirm
// step: it's one tap to undo. Passing on asks in place for what's missing of
// its size (buyers are matched by it), asking price and condition.
export function PassOnToggle({
  itemId,
  status,
  size,
  askingPriceCents,
  condition,
}: {
  itemId: string;
  status: ItemStatus;
  size: string | null;
  askingPriceCents: number | null;
  condition: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [askingSize, setAskingSize] = useState(false);
  // Until the refreshed page brings the new status (and label) back.
  const [refreshing, startRefresh] = useTransition();
  const busy = saving || refreshing;
  const [problem, setProblem] = useState<string | null>(null);
  const next: ItemStatus = status === "passing_on" ? "active" : "passing_on";

  async function send(body: Parameters<typeof patchItem>[1]): Promise<string | null> {
    const failed = await patchItem(itemId, body);
    if (!failed) {
      startRefresh(() => {
        setAskingSize(false);
        router.refresh();
      });
    }
    return failed;
  }

  async function toggle() {
    if (next === "passing_on" && (!size || askingPriceCents === null || !condition)) {
      setProblem(null);
      setAskingSize(true);
      return;
    }
    setSaving(true);
    setProblem(null);
    setProblem(await send({ status: next }));
    setSaving(false);
  }

  if (askingSize) {
    return (
      <ListingForm
        initial={{ size, askingPriceCents, condition }}
        submitLabel="Pass it on"
        busyLabel="Saving…"
        onSave={(listing) => send({ status: "passing_on", ...listing })}
        onCancel={() => setAskingSize(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={toggle} disabled={busy} className="btn-text self-start">
        {next === "passing_on" ? "Pass it on" : "Keep wearing it"}
      </button>
      {problem && (
        <p role="alert" className="text-sm font-medium">
          {problem}
        </p>
      )}
    </div>
  );
}
