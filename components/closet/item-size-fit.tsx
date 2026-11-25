"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DEMO_READ_ONLY } from "@/lib/auth/messages";
import { SIZE_FIT_LABELS, SIZE_FITS, type SizeFit } from "@/lib/sizing/fit";

// What tapping an answer saves: that answer, or none when it is the current one.
export function nextSizeFit(current: SizeFit | null, tapped: SizeFit): SizeFit | null {
  return current === tapped ? null : tapped;
}

export const SIZE_MISSING = "Add its size in Edit details so this counts in your next check.";

// "How did this size fit?" One tap saves; tapping the current answer clears
// it. It only counts with a size, so one without asks for it. The demo
// account sees the answer and can't change it; with none it sees nothing.
export function ItemSizeFit({
  itemId,
  sizeFit,
  hasSize,
  readOnly,
}: {
  itemId: string;
  sizeFit: SizeFit | null;
  hasSize: boolean;
  readOnly: boolean;
}) {
  const router = useRouter();
  // Shown at once; the refreshed page brings the saved value back.
  const [shown, setShown] = useState(sizeFit);
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);

  if (readOnly) {
    if (sizeFit === null) return null;
    return (
      <p data-testid="item-size-fit" className="text-sm text-ink-2">
        Size fit: <span className="text-ink">{SIZE_FIT_LABELS[sizeFit]}</span>
      </p>
    );
  }

  async function answer(tapped: SizeFit) {
    const before = shown;
    const next = nextSizeFit(before, tapped);
    setShown(next);
    setSaving(true);
    setProblem(null);
    const res = await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sizeFit: next }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      setShown(before);
      setProblem(res?.status === 403 ? DEMO_READ_ONLY : "Couldn't save. Try again.");
      return;
    }
    startRefresh(() => router.refresh());
  }

  return (
    <fieldset className="flex flex-col gap-2" data-testid="item-size-fit" data-size-fit={shown ?? ""}>
      <legend className="mb-2 text-sm text-ink-2">How did this size fit?</legend>
      <div className="flex flex-wrap gap-2">
        {SIZE_FITS.map((fit) => (
          <button
            key={fit}
            type="button"
            disabled={saving || refreshing}
            aria-pressed={shown === fit}
            onClick={() => answer(fit)}
            className="chip"
          >
            {SIZE_FIT_LABELS[fit]}
          </button>
        ))}
      </div>
      {shown !== null && !hasSize && <p className="text-sm text-ink-2">{SIZE_MISSING}</p>}
      {problem && (
        <p role="alert" className="text-sm font-medium">
          {problem}
        </p>
      )}
    </fieldset>
  );
}
