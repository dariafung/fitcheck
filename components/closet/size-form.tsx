"use client";

import { useId, useState } from "react";
import { DEMO_READ_ONLY } from "@/lib/auth/messages";
import { ITEM_SIZE_PLACEHOLDER, MAX_ITEM_SIZE_LENGTH } from "@/lib/resale/size";
import { SAVE_FAILED } from "@/components/entry/messages";

export const SIZE_FIRST = "Add a size first.";

// Asks for an item's size in place, set like the item card's fields: the
// label above, then "[   ] [Save] Cancel" on one line.
// onSave gets the trimmed size and returns a problem to show, or null.
export function SizeForm({
  initial,
  submitLabel,
  busyLabel,
  onSave,
  onCancel,
}: {
  initial: string;
  submitLabel: string;
  busyLabel: string;
  onSave: (size: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const id = useId();
  const [size, setSize] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = size.trim();
    if (!trimmed) {
      setProblem(SIZE_FIRST);
      return;
    }
    setSaving(true);
    setProblem(null);
    const next = await onSave(trimmed);
    setSaving(false);
    setProblem(next);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 text-sm">
      <label htmlFor={id} className="text-ink-2">
        What size is it?
      </label>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <input
          id={id}
          className="field w-32"
          value={size}
          maxLength={MAX_ITEM_SIZE_LENGTH}
          placeholder={ITEM_SIZE_PLACEHOLDER}
          autoFocus
          onChange={(e) => setSize(e.target.value)}
        />
        <button type="submit" disabled={saving} className="btn-secondary">
          {saving ? busyLabel : submitLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="btn-text">
          Cancel
        </button>
      </div>
      {problem && (
        <p role="alert" className="text-sm font-medium">
          {problem}
        </p>
      )}
    </form>
  );
}

// Sends a size (and maybe a status) to the item; the problem to show, or null.
export async function patchItem(itemId: string, body: { status?: string; size?: string }): Promise<string | null> {
  const res = await fetch(`/api/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (res?.ok) return null;
  if (res?.status === 403) return DEMO_READ_ONLY;
  if (res?.status === 400) {
    const { error } = (await res.json().catch(() => ({}))) as { error?: string };
    if (error === "size_required") return SIZE_FIRST;
  }
  return SAVE_FAILED;
}
