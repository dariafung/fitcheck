"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DEMO_READ_ONLY } from "@/lib/auth/messages";
import type { ItemStatus } from "@/lib/closet/item-patch";

// Moves an item between worn (active) and Passing on, and back. No confirm
// step: it's one tap to undo.
export function PassOnToggle({ itemId, status }: { itemId: string; status: ItemStatus }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  // Until the refreshed page brings the new status (and label) back.
  const [refreshing, startRefresh] = useTransition();
  const busy = saving || refreshing;
  const [problem, setProblem] = useState<string | null>(null);
  const next: ItemStatus = status === "passing_on" ? "active" : "passing_on";

  async function toggle() {
    setSaving(true);
    setProblem(null);
    const res = await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      setProblem(res?.status === 403 ? DEMO_READ_ONLY : "Couldn't save. Try again.");
      return;
    }
    startRefresh(() => router.refresh());
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
