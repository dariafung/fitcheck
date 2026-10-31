"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ItemStatus } from "@/lib/closet/item-patch";
import { patchItem, SizeForm } from "./size-form";

// Moves an item between worn (active) and Passing on, and back. No confirm
// step: it's one tap to undo. An item without a size asks for one first,
// in place, since buyers are matched by it.
export function PassOnToggle({
  itemId,
  status,
  size,
}: {
  itemId: string;
  status: ItemStatus;
  size: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [askingSize, setAskingSize] = useState(false);
  // Until the refreshed page brings the new status (and label) back.
  const [refreshing, startRefresh] = useTransition();
  const busy = saving || refreshing;
  const [problem, setProblem] = useState<string | null>(null);
  const next: ItemStatus = status === "passing_on" ? "active" : "passing_on";

  async function send(body: { status: ItemStatus; size?: string }): Promise<string | null> {
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
    if (next === "passing_on" && !size) {
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
      <SizeForm
        initial=""
        submitLabel="Pass it on"
        busyLabel="Saving…"
        onSave={(typed) => send({ status: "passing_on", size: typed })}
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
